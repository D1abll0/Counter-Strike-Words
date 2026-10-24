CREATE TABLE dailyWord (
	lang TEXT,
	word TEXT,
	attempts INTEGER,
	date TEXT,
	number INTEGER,
	community TEXT
);

CREATE TABLE users (
	id TEXT NOT NULL UNIQUE,			-- Discord user id
	name TEXT,
	avatar TEXT
);

CREATE TABLE guilds (
	guildId TEXT NOT NULL UNIQUE,		-- Discord guild id
	firstStreakDay INTEGER NOT NULL
);

CREATE TABLE dailyGuildPlayers (
	userId INTEGER NOT NULL,			-- users.rowid
	guildId INTEGER NOT NULL,			-- guilds.rowid
	PRIMARY KEY (userId, guildId)
);

CREATE TABLE dailyStats (
	userId INTEGER NOT NULL UNIQUE,		-- users.rowid
	words TEXT NOT NULL DEFAULT '',
	characterStatuses TEXT NOT NULL DEFAULT '',
	isFinished INTEGER NOT NULL DEFAULT 0,
	isSolved INTEGER NOT NULL DEFAULT 0,
	timeStart INTEGER,
	timeEnd INTEGER
);

CREATE INDEX dailyGuildPlayersGuild ON dailyGuildPlayers(guildId);