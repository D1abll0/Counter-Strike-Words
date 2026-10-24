/**
 * Cloudflare Worker — backend for a Discord Activity.
 *
 * IMPORTANT: this is NOT an Express/Node server. Workers don't run a
 * persistent process — they export a `fetch` handler that runs once
 * per request. There is no app.listen(), no process.env (env vars and
 * secrets arrive as the second argument), and no need for node-fetch
 * (fetch is a global).
 *
 * Routing note: when Discord's proxy forwards a request that matched a
 * Proxy Path Mapping (e.g. prefix "/api" -> this Worker's domain), it
 * strips the mapped prefix before forwarding. So a client request to
 *   /.proxy/api/token
 * arrives here as just
 *   POST /token
 * That's why the route check below matches on a suffix, not the full
 * "/api/token" path — hardcoding the full path is the #1 cause of a
 * 404 here even though everything else is configured correctly.
 */

import * as DB from './dbQuery.js'

import { GOOGLE_SPREADSHEET_BASE, ALPHABET } from './constants.js'

import { createSessionToken, isSessionActual, normalizeWord, getSigningKey, fromBase64Url, formatTime, getAvatarDataUri, svgToPng, hexToBytes } from './utils.js'

import { buildTopSVG, buildPlayerCardSVG } from './svg.js'

function withCors(response)
{
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	headers.set("Content-Type", "application/json; charset=utf-8");
	return new Response(response.body,
	{
		status: response.status,
		headers,
	});
}

async function getDiscordAccessToken(code, env)
{
	const response = await fetch("https://discord.com/api/oauth2/token",
	{
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(
		{
			client_id: env.DISCORD_CLIENT_ID,
			client_secret: env.DISCORD_CLIENT_SECRET,
			grant_type: "authorization_code",
			code,
		}),
	});

	const data = await response.json();

	if(response.ok) return {
		ok: true,
		access_token: data.access_token
	};

	return {
		ok: false,
		error: 'Token exchange failed.',
		status: response.status
	};
}

async function initializeUser(access_token, env)
{
	const response = await fetch("https://discord.com/api/users/@me", 
	{
		headers: {Authorization: `Bearer ${access_token}`}
	});

	const data = await response.json().catch(_ => ({}));
	if(!data.id || !(data.global_name || data.username)) return null;

	let id = String(data.id);
	let name = data.global_name || data.username;
	let ext = data.avatar?.startsWith('a_') ? 'gif' : 'png';
	let avatar = data.avatar ? `https://cdn.discordapp.com/avatars/${id}/${data.avatar}.${ext}?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png';

	return await DB.dbUpdateUser(env, {id, name, avatar});
}

async function authenticate(request, env)
{
	if(!env.SESSION_SECRET) return null;

	const header = request.headers.get('Authorization') || '';
	if(!header.startsWith('Bearer ')) return null;

	const parts = header.slice(7).split('.');
	if(parts.length != 5) return null;

	const [userId, guildId, number, expires, signature] = parts;
	if(!(Number(expires) > Date.now())) return null;
	if(!signature) return null;

	if(!userId || guildId == null || !number || expires == null || typeof signature !== 'string' || !signature.length) return null;

	const key = await getSigningKey(env);
	const bytes = fromBase64Url(signature);
	const payload = `${userId}.${guildId}.${number}.${expires}`;

	const valid = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(payload));
	if(!valid) return null;

	return { userId, guildId, number };
}

function determineStatuses(guessWord, dailyWord)
{
	let statuses = '';
	
	for(let i = 0; i < guessWord.length; i++)
	{
		if(guessWord[i] == dailyWord[i]) statuses += 'c';
		else if(dailyWord.includes(guessWord[i])) statuses += 'p';
		else statuses += 'a';
	}

	return statuses;
}

function createUserSave(user, lang, wordLength)
{
	let words = user.words.split('');
	let statuses = user.characterStatuses.split('')

	let keyCodes = [];
	for(let char of user.words.split(''))
		keyCodes.push(ALPHABET[lang][char.charCodeAt()]);

	return {
		words,
		statuses,
		keyCodes,
		usedAttempts: Math.floor(statuses.length / wordLength),
		isFinished: Boolean(user.isFinished),
		isSolved: Boolean(user.isSolved)
	};
}

function createPlayersResults(players, wordLength, attempts, user, onlyYours)
{
	let data = [];

	for(let player of players)
	{
		if(onlyYours && player.id != user.id) continue;

		let playerData = {};

		let completedWords = Math.floor(player.characterStatuses.length / wordLength);
		let statuses = player.characterStatuses.slice(0, wordLength * completedWords).split('');

		let usedAttempts = Math.floor(statuses.length / wordLength);

		playerData['userId'] = player.id;
		playerData['name'] = player.name;
		playerData['avatar'] = player.avatar;
		playerData['statuses'] = statuses;
		if(player.isSolved) playerData['result'] = `${usedAttempts} / ${attempts}`;
		else if(!player.isSolved && player.isFinished) playerData['result'] = `x / ${attempts}`;
		else playerData['result'] = '';

		if(player.timeStart !== null && player.timeEnd !== null)
			playerData['time'] = formatTime(player.timeStart, player.timeEnd);

		if(player.id == user.id || user.isSolved)
		{
			playerData['letters'] = player.words.slice(0, wordLength * completedWords).split('');
			playerData['isSolved'] = Boolean(user.isSolved);
			playerData['isFinished'] = Boolean(user.isFinished);
		}

		data.push(playerData);
	}

	return data;
}

async function handleOpen()
{
	return withCors(new Response("OK"));
}

async function handleLogin(request, env)
{
	const inputData = await request.json().catch(_ => ({}));
	if(!inputData.code) 
		return withCors(new Response(
			JSON.stringify({error: "Missing `code`"}),
			{ status: 400 }
		));

	if(!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET)
		return withCors(new Response(
			JSON.stringify({ error: "Worker misconfigured: missing DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET/SESSION_SECRET" }),
			{ status: 500 }
		));

	let response = await getDiscordAccessToken(inputData.code, env);
	if(!response.ok)
		return withCors(new Response(
			JSON.stringify({error: response.error}),
			{ status: response.status }
		));

	const rowId = await initializeUser(response.access_token, env);
	if(rowId === null) 
		return withCors(new Response(
			JSON.stringify({error: "Failed to get the Discord user"}),
			{ status: 502 }
		));

	await DB.dbCreateDailyStats(env, {rowId});
	await DB.dbAddGuildPlayer(env, {guildId: inputData.guildId, rowId});

	const dailyWord = await DB.dbGetDailyWord(env);

	const userResult = await DB.dbGetDailyUserResult(env, {type: 'rowId', id: rowId});

	const playersResult = await DB.dbGetDailyPlayersResult(env, {userId: userResult.id, guildId: inputData.guildId});

	let wordLength = dailyWord.word.length;

	const result = {
		access_token: response.access_token,
		token: await createSessionToken(env, userResult.id, inputData.guildId, dailyWord.number),
		userId: userResult.id,
		word: {
			length: wordLength,
			attempts: dailyWord.attempts,
			lang: dailyWord.lang,
			community: dailyWord.community
		},
		version: {
			date: dailyWord.date,
			issueNumber: `No. ${dailyWord.number}`
		},
		players: createPlayersResults(playersResult, wordLength, dailyWord.attempts, userResult),
		save: createUserSave(userResult, dailyWord.lang, wordLength)
	};
	return withCors(Response.json(result));
}

async function handleGuess(request, env)
{
	const session = await authenticate(request, env);
	if(!session) 
		return withCors(new Response(
			JSON.stringify({error: "Unauthorized"}),
			{ status: 401 }
		));

	const inputData = await request.json().catch(_ => ({}));
	if(!inputData.word) 
		return withCors(new Response(
			JSON.stringify({error: "Invalid data provided."}),
			{ status: 400 }
		))

	const dailyWord = await DB.dbGetDailyWord(env);
	if(!isSessionActual(session, dailyWord)) 
		return withCors(new Response(
			JSON.stringify({error: "The word has changed"}),
			{ status: 409 }
		));

	const playerProgress = await DB.dbGetDailyPlayerProgress(env, {userId: session.userId});
	if(!playerProgress)
		return withCors(new Response(
			JSON.stringify({error: "Player not found"}),
			{ status: 400 }
		));

	if(playerProgress.isFinished)
		return withCors(new Response(
			JSON.stringify({error: "The word has already been completed"}),
			{ status: 400 }
		));

	const word = normalizeWord(inputData.word, dailyWord.lang);
	if(word == null)
		return withCors(new Response(
			JSON.stringify({error: "The word contains unallowable characters. The word must consist only of letters"}),
			{ status: 400 }
		));
	if(word.length != dailyWord.word.length)
		return withCors(new Response(
			JSON.stringify({error: "The word has the incorrect size"}),
			{ status: 400 }
		));

	const usedStatuses = playerProgress.characterStatuses
	const usedAttempts = usedStatuses.length / dailyWord.word.length;
	const usedWords = playerProgress.words.slice(0, usedStatuses.length);

	const statuses = determineStatuses(word, dailyWord.word);
	const isSolved = word === dailyWord.word;
	const isFinished = isSolved || usedAttempts + 1 >= dailyWord.attempts;
	const timeStart = playerProgress.timeStart === null ? new Date().getTime() : Number(playerProgress.timeStart);
	const timeEnd = isFinished ? new Date().getTime() : null;

	await DB.dbSubmitNewPlayerAttempt(env, {
		userId: session.userId,
		words: usedWords + word,
		statuses: usedStatuses + statuses,
		isFinished,
		isSolved,
		timeStart,
		timeEnd
	});

	return withCors(Response.json({word, statuses, isFinished, isSolved, usedAttempts}));
}

async function handleResults(request, env)
{
	const session = await authenticate(request, env);
	if(!session)
		return withCors(new Response(
			JSON.stringify({error: "Unauthorized"}),
			{ status: 401 }
		));

	const inputData = await request.json().catch(_ => ({}));
	if(inputData.onlyYours === undefined)
		return withCors(new Response(
			JSON.stringify({error: "Invalid data provided."}),
			{ status: 400 }
		))

	const dailyWord = await DB.dbGetDailyWord(env);
	if(!isSessionActual(session, dailyWord))
		return withCors(new Response(
			JSON.stringify({error: "The word has changed"}),
			{ status: 409 }
		));

	const userResult = await DB.dbGetDailyUserResult(env, {type: 'userId', id: session.userId});
	if(!userResult)
		return withCors(new Response(
			JSON.stringify({error: "Player not found"}),
			{ status: 400 }
		));

	const playersResult = await DB.dbGetDailyPlayersResult(env, {guildId: session.guildId, userId: session.userId});

	return withCors(Response.json(createPlayersResults(playersResult, dailyWord.word.length, dailyWord.attempts, userResult, inputData.onlyYours)));
}

async function handleExit(request, env)
{
	const session = await authenticate(request, env);
	if(!session)
		return withCors(new Response(
			JSON.stringify({error: "Unauthorized"}),
			{ status: 401 }
		));

	const inputData = await request.json().catch(_ => ({}));
	if(inputData.word === undefined)
		return withCors(new Response(
			JSON.stringify({error: "Invalid data provided."}),
			{ status: 404 }
		))

	const dailyWord = await DB.dbGetDailyWord(env);
	if(!isSessionActual(session, dailyWord))
		return withCors(new Response(
			JSON.stringify({error: "The word has changed"}),
			{ status: 409 }
		));

	const word = normalizeWord(inputData.word, dailyWord.lang);
	if(word == null)
		return withCors(new Response(
			JSON.stringify({error: "The word contains unallowable characters. The word must consist only of letters"}),
			{ status: 400 }
		));
	if(word.length > dailyWord.word.length)
		return withCors(new Response(
			JSON.stringify({error: "The word has the incorrect size"}),
			{ status: 400 }
		));

	await DB.dbSaveDraftWord(env, {userId: session.userId, word});

	return withCors(Response.json({ ok: true }));
}

async function verifyDiscordRequest(request, publicKeyHex)
{
	const signature = request.headers.get("x-signature-ed25519");
	const timestamp = request.headers.get("x-signature-timestamp");
	if(!signature || !timestamp) return { valid: false };

	const bodyText = await request.clone().text();

	const key = await crypto.subtle.importKey(
		"raw",
		hexToBytes(publicKeyHex),
		{ name: "Ed25519" },
		false,
		["verify"]
	);

	const valid = await crypto.subtle.verify(
		"Ed25519",
		key,
		hexToBytes(signature),
		new TextEncoder().encode(timestamp + bodyText)
	);

	return { valid, bodyText };
}

async function handleInteraction(request, env)
{
	const { valid, bodyText } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
	if(!valid)
		return withCors(new Response(
			JSON.stringify({error: "Bad request signature"}),
			{ status: 401 }
		));

	const interaction = JSON.parse(bodyText);

	if(interaction.type === 1) return Response.json({ type: 1 }); // PING
	if(interaction.type === 3 && interaction.data?.custom_id === "play_now") return Response.json({ type: 12 })

	return withCors(new Response(
		JSON.stringify({error: "Unhandled interaction type"}),
		{ status: 400 }
	));
}

async function syncExternalData(env)
{
	const MAX_ATTEMPTS = 10;

	const resp = await fetch(GOOGLE_SPREADSHEET_BASE);
	if(!resp.ok)
	{
		console.error("External API error:", resp.status, await resp.text());
		return;
	}

	const data = await resp.json();
	if(!Array.isArray(data) || data.length == 0) return;
	const pair = data[Math.floor(Math.random() * data.length)];
	
	const word = pair[1];
	const _pair = pair[0].split('-');
	const lang = _pair.length == 1 ? _pair[0] : _pair[1];
	const community = _pair.length == 1 ? '' : _pair[0];

	let attempts = 5;
	let chance = Math.random();

	if(word.length == 5)
	{
		if(chance > 0.6) attempts = 6;
		if(chance > 0.95) attempts = 4;
	}
	if(word.length < 5)
	{
		if(chance > 0.9) attempts = 6;
		if(chance < 0.2) attempts = 4;
	}
	if(word.length > 5 && word.length < 9)
	{
		if(chance > 0.3) attempts = 6;
		if(chance > 0.6) attempts = 7;
		if(chance > 0.95) attempts = 8;
	}
	if(word.length == 9)
	{
		attempts = 6;
		if(chance > 0.4) attempts = 7;
		if(chance > 0.5) attempts = 8;
		if(chance > 0.6) attempts = 9;
		if(chance > 0.75) attempts = MAX_ATTEMPTS;
		if(chance > 0.95) attempts = 5;
	}
	if(word.length >= 10)
	{
		attempts = 7;
		if(chance > 0.3) attempts = 8;
		if(chance > 0.5) attempts = 9;
		if(chance > 0.7) attempts = MAX_ATTEMPTS;
		if(chance > 0.90) attempts = 6;
		if(chance > 0.95) attempts = 5;
	}

	const date = new Date().toLocaleDateString('en-UK');

	await sendDailyResults(env).catch(error => console.error('sendDailyResults:', error));

	await DB.dbResetWord(env, { lang, word, attempts, date, community });
}

async function getGuildChannelId(env, guildId)
{
	const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`,
	{
		headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
	});
 
	if(!response.ok) return null;
	return (await response.json()).system_channel_id;
}

async function sendDailyResultsToGuild(env, guildId, results, dailyWord)
{
	if(!guildId) return;
 
	const channelId = await getGuildChannelId(env, guildId);
	if(!channelId) return;
 
	const wordLength = dailyWord.word.length;
	const attempts = dailyWord.attempts;
 
	let text = `# Counter Strike Word\n`
		+ `Word of the day · *${dailyWord.word}* · No. ${dailyWord.number}\n\n`
		+ `**${results.count.players} users took part**\n`
 
	if(!results.top.length) text += `\n\nUnfortunately nobody solved the word.`;
	else
	{
		text += `**${results.count.solvers} participants solved the word of the day**`;

		if(results.top.length == 1) text += `\n\n*Result*\n`;
		else if(results.top.length >= 10) text += `\n\n*Results (top 10)*\n`;
		else text += `\n\n*Results (top ${results.top.length})*\n`;

		text += `\`#  | Score  | Time      \`\n`;
 
		results.top.forEach((player, i) =>
		{
			const place = String(i + 1).padEnd(3);
			const score = `${player.statuses.length / wordLength}/${attempts}`.padEnd(8);
			const time = formatTime(player.timeStart, player.timeEnd).padEnd(11);
			text += `\`${place}| ${score}| ${time}\n\` <@${player.id}>\n`;
		});
	}
 
	const components = [{ type: 10, content: text }];
	const formData = new FormData();
	let attachments = [];
 
	if(results.top.length)
	{
		const cards = [];
		for(const player of results.top.slice(0, 3))
		{
			const data = {
				avatarHref: await getAvatarDataUri(player.avatar),
				username: player.name,
				statuses: player.statuses.split(''),
				letters: player.words.split(''),
				wordLength: wordLength,
				attempts: attempts
			};
			cards.push(buildPlayerCardSVG(data));
		}
 
		const {svg, width, height} = buildTopSVG(cards, 'row');
		const png = await svgToPng(env, svg, width, height);
 
		const fileName = 'results.png';
		formData.append('files[0]', new Blob([png], { type: 'image/png' }), fileName);
		attachments = [{ id: 0, filename: fileName }];
		components.push({ type: 12, items: [{ media: { url: `attachment://${fileName}` }, description: 'Top players of the day' }] });
	}
 
	components.push({ type: 1, components: [{ type: 2, style: 3, label: 'Play now!', custom_id: 'play_now' }] });
 
	formData.append('payload_json', JSON.stringify({
		flags: 32768,
		components: components,
		attachments: attachments,
		allowed_mentions: { parse: [] }
	}));
 
	const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`,
	{
		method: 'POST',
		headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
		body: formData
	});
 
	if(!response.ok) throw new Error(`Discord ${response.status}: ${await response.text()}`);
}

async function sendDailyResults(env)
{
	const dailyWord = await DB.dbGetDailyWord(env);
	const dailyStats = await DB.dbGetDailyStats(env);

	const guilds  = {};

	for(let result of dailyStats.counts.results)
	{
		guilds[result.guildId] = {
			count: {
				players: result.players,
				solvers: result.solvers,
			},
			top: []
		};
	}

	for(let result of dailyStats.tops.results)
	{
		guilds[result.guildId].top.push({
			id: result.userId,
			name: result.name,
			avatar: result.avatar,
			words: result.words,
			statuses: result.characterStatuses,
			timeStart: result.timeStart,
			timeEnd: result.timeEnd,
		});
	}

	const tasks = [];
	for(const [guildId, results] of Object.entries(guilds))
		tasks.push(sendDailyResultsToGuild(env, guildId, results, dailyWord))
	await Promise.allSettled(tasks);
}

export default
{
	async fetch(request, env, ctx)
	{
		const url = new URL(request.url);

		if(request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

		if(url.pathname === "/interactions" && request.method === "POST") return handleInteraction(request, env);

		if(request.method === "GET" && (url.pathname === "/" || url.pathname === "")) return handleOpen();

		if(request.method === "POST" && url.pathname.endsWith("/login")) return handleLogin(request, env);

		if(request.method === "POST" && url.pathname.endsWith("/guess")) return handleGuess(request, env);

		if(request.method === "POST" && url.pathname.endsWith("/results")) return handleResults(request, env);

		if(request.method === "POST" && url.pathname.endsWith("/exit")) return handleExit(request, env);

		if(request.method === "POST" && url.pathname.endsWith("/admin/sync"))
		{
			if(!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY)
				return withCors(new Response(JSON.stringify({error: "Not found"}), { status: 404 }));

			await syncExternalData(env);
			return withCors(new Response(JSON.stringify({ok: true})));
		}

		return withCors(new Response(
			JSON.stringify({error: "Not found"}),
			{ status: 404 }
		));
	},

	async scheduled(event, env, ctx) { ctx.waitUntil(syncExternalData(env)); },
};