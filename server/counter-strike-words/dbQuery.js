export async function dbUpdateUser(env, data)
{
	let query = 'INSERT INTO users (id, name, avatar) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar RETURNING rowid;';
	let result = await env.DB.prepare(query).bind(data.id, data.name, data.avatar).first();
    return result.rowid;
}

export async function dbCreateDailyStats(env, data)
{
	let query = 'INSERT INTO dailyStats (userId, words, characterStatuses, isFinished, isSolved) VALUES (?, ?, ?, ?, ?) ON CONFLICT(userId) DO NOTHING;';
	await env.DB.prepare(query).bind(data.rowId, "", "", 0, 0).run();
}

export async function dbAddGuildPlayer(env, data)
{
	const today = new Date().getTime();

	await env.DB.batch([
		env.DB.prepare('INSERT INTO guilds (guildId, firstStreakDay) VALUES (?, ?) ON CONFLICT(guildId) DO NOTHING;').bind(data.guildId, today),
		env.DB.prepare('INSERT OR IGNORE INTO dailyGuildPlayers (userId, guildId) SELECT ?, rowid FROM guilds WHERE guildId = ?;').bind(data.rowId, data.guildId)
	]);
}

export async function dbGetDailyWord(env)
{
	let query = 'SELECT * FROM dailyWord;';
	return await env.DB.prepare(query).first();
}

export async function dbGetDailyUserResult(env, data)
{
	let query = '';

	if(data.type == 'rowId') query = 'SELECT u.id, ds.words, ds.characterStatuses, ds.isFinished, ds.isSolved FROM dailyStats ds JOIN users u ON ds.userId = u.rowid WHERE ds.userId = ?;';
	if(data.type == 'userId') query = 'SELECT u.id, ds.words, ds.characterStatuses, ds.isFinished, ds.isSolved FROM dailyStats ds JOIN users u ON ds.userId = u.rowid WHERE u.id = ?;';

	return await env.DB.prepare(query).bind(data.id).first();
}

export async function dbGetDailyPlayersResult(env, data)
{
	if(data.guildId)
	{
		let query = 'SELECT u.id, u.name, u.avatar, ds.words, ds.characterStatuses, ds.isSolved, ds.isFinished, ds.timeStart, ds.timeEnd FROM dailyGuildPlayers dgp JOIN guilds g ON g.rowId = dgp.guildId JOIN dailyStats ds ON ds.userId = dgp.userId JOIN users u ON u.rowid = ds.userId WHERE g.guildId = ?;';
		let {results} = await env.DB.prepare(query).bind(data.guildId).all();
		return results;
	}
	else
	{
		let query = 'SELECT u.id, u.name, u.avatar, ds.words, ds.characterStatuses, ds.isSolved, ds.isFinished, ds.timeStart, ds.timeEnd FROM dailyStats ds JOIN users u ON ds.userId = u.rowid WHERE u.id = ?;';
		let {results} = await env.DB.prepare(query).bind(data.userId).all();
    	return results;
	}
}

export async function dbGetDailyPlayerProgress(env, data)
{
	let query = 'SELECT ds.words, ds.characterStatuses, ds.isFinished, ds.timeStart, ds.timeEnd FROM dailyStats ds JOIN users u ON ds.userId = u.rowid WHERE u.id = ?;';
	return await env.DB.prepare(query).bind(data.userId).first();
}

export async function dbSubmitNewPlayerAttempt(env, data)
{
	let query = 'UPDATE dailyStats SET characterStatuses = ?, words = ?, isFinished = ?, isSolved = ?, timeStart = ?, timeEnd = ? WHERE userId = (SELECT rowid FROM users WHERE id = ?);';
	await env.DB.prepare(query).bind(data.statuses, data.words, Number(data.isFinished), Number(data.isSolved), data.timeStart, data.timeEnd, data.userId).run();
}

export async function dbSaveDraftWord(env, data)
{
	let query = 'UPDATE dailyStats SET words = substr(words, 1, length(characterStatuses)) || ? WHERE userId = (SELECT rowid FROM users WHERE id = ?) AND isFinished = 0;';
	await env.DB.prepare(query).bind(data.word, data.userId).run();
}

export async function dbResetWord(env, data)
{
	let query = 'INSERT INTO dailyWord (rowid, lang, word, attempts, date, number, community) VALUES(1, ?, ?, ?, ?, 1, ?) ON CONFLICT(rowid) DO UPDATE SET lang=excluded.lang, word=excluded.word, attempts=excluded.attempts, date=excluded.date, number=dailyWord.number + 1, community=excluded.community;';
	await env.DB.batch([
		env.DB.prepare(query).bind(data.lang, data.word, data.attempts, data.date, data.community),
		env.DB.prepare('DELETE FROM dailyStats;'),
		env.DB.prepare('DELETE FROM dailyGuildPlayers;'),
		// env.DB.prepare('DELETE FROM users;')
	]);
}

export async function dbGetDailyStats(env)
{
	let query1 = 'SELECT g.guildId, COUNT(*) AS players, SUM(isSolved) AS solvers FROM dailyGuildPlayers dgp JOIN guilds g ON g.rowId = dgp.guildId JOIN dailyStats ds ON ds.userId = dgp.userId GROUP BY g.guildId;';
	let query2 = 'SELECT * FROM (SELECT g.guildId, ds.words, ds.characterStatuses, ds.timeStart, ds.timeEnd, u.id AS userId, u.name, u.avatar, ROW_NUMBER() OVER (PARTITION BY g.guildId ORDER BY length(ds.characterStatuses), (ds.timeEnd - ds.timeStart) IS NULL, ds.timeEnd - ds.timeStart, ds.userId) AS rank FROM dailyGuildPlayers  dgp JOIN guilds g ON g.rowId = dgp.guildId JOIN dailyStats ds ON ds.userId = dgp.userId JOIN users u ON u.rowid = ds.userId WHERE ds.isSolved = 1) WHERE rank <= 10;';
	const [counts, tops] = await env.DB.batch([
		env.DB.prepare(query1),
		env.DB.prepare(query2)
	]);

	return {counts, tops};
}