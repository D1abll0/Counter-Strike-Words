import { DiscordSDK } from "@discord/embedded-app-sdk";

const clientId = import.meta.env.DISCORD_CLIENT_ID;
if(!clientId) throw new Error("Developer is an Idiot!");

const discordSdk =  new DiscordSDK(clientId);

export async function DiscordAuthorize()
{
	await discordSdk.ready();

	const { code } = await discordSdk.commands.authorize({
		client_id: clientId,
		response_type: 'code',
		state: '',
		prompt: 'none',
		scope: ['identify', 'guilds'],
	});

	return {code, guildId: discordSdk.guildId};
}

export async function DiscordAuthenticate(token)
{
	const auth = await discordSdk.commands.authenticate({ access_token: token });
	if(!auth) throw new Error('Authenticate command failed.');
}

export function DiscordDisconnect()
{
	discordSdk.close(1000);
}