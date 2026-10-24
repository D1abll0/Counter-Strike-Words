import { SESSION_TTL, ALPHABET } from './constants.js'
const encoder = new TextEncoder();

export function hexToBytes(hex)
{
	const bytes = new Uint8Array(hex.length / 2);
	for(let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	return bytes;
}

export function toBase64Url(buffer)
{
	let binary = '';
	for(let byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text)
{
	let base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	while(base64.length % 4) base64 += '=';

	let binary = atob(base64);
	let bytes = new Uint8Array(binary.length);
	for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function getSigningKey(env)
{
	return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(env, userId, guildId, number)
{
	const payload = `${userId}.${guildId}.${number}.${Date.now() + SESSION_TTL}`;
	const signature = await crypto.subtle.sign('HMAC', await getSigningKey(env), encoder.encode(payload));
	return `${payload}.${toBase64Url(signature)}`;
}

export function isSessionActual(session, dailyWord)
{
	return session.number == String(dailyWord.number);
}

export function normalizeWord(word, lang)
{
	if(typeof word !== 'string' || !ALPHABET[lang]) return null;

	let result = '';
	for(let char of word)
	{
		let letter = char.toUpperCase();
		if(letter.length != 1 || !ALPHABET[lang][letter.charCodeAt(0)]) return null;
		result += letter;
	}
	return result;
}

export function formatTime(time1, time2)
{
	if(time1 === null || time2 === null) return '';

	const dt = time2 - time1;
	if(dt == 0) return '—';

	const time = new Date(dt).toJSON();
	return time.split('T')[1].slice(0, -3);
}

export async function getAvatarDataUri(avatarUrl)
{
	const url = (avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png') .replace(/\.(webp|gif|jpg)/, '.png').split('?')[0] + '?size=128';

	const response = await fetch(url);
	const bytes = new Uint8Array(await response.arrayBuffer());

	let binary = '';
	for(let i = 0; i < bytes.length; i += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

	return `data:image/png;base64,${btoa(binary)}`;
}

export async function svgToPng(env, svg, width, height)
{
	const response = await env.SVG_CONVERTER.fetch("https://svg-converter/convert",
	{
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ svg, width, height, scale: 4 })
	});

	if(!response.ok) throw new Error(`SVG_CONVERTER: ${response.status} ${await response.text()}`);
	return await response.arrayBuffer();
}