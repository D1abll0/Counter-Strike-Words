import { DiscordAuthorize, DiscordAuthenticate } from "./discord.js";
import ApiClient from './ApiClient.js'
import Game from './game.js'
import ComponentManager from './componentManager.js'
import Keyboard from './keyboard.js'
import Board from './board.js'
import AboutContent from './aboutContent.js'
import PlayersContent from './playerContent.js'

const keyboardOptionBtn = document.querySelector('#option-btns .option-keyboard');
const boardOptionBtn = document.querySelector('#option-btns .option-board');
const playersOptionBtn = document.querySelector('#option-btns .option-players');
const optionBtn = document.querySelector('#option-btns .option-options');

const app = document.getElementById("app");

const manager = new ComponentManager(app);

async function setup()
{
	const api = new ApiClient('.proxy/api');

	await manager.animation.run(1);

	let { code, guildId } = await DiscordAuthorize();
	const data = await api.login(code, guildId); 
	await DiscordAuthenticate(data.access_token);

	manager.animation.stop();
	await manager.animation.run(2);

	const boardSettings = {wordLength: data.word.length, attempts: data.word.attempts};
	const keyboardSettings = {lang: data.word.lang};
	const playersSettings = {
		words: {wordLength: data.word.length, attempts: data.word.attempts},
		users: data.players,
		actions: {
			loadResults: onlyYours => api.fetchResults(onlyYours)
		}
	};
	const aboutSettings = {date: data.version.date, issueNumber: data.version.issueNumber};

	const board = new Board(boardSettings);
	const keyboard = new Keyboard(keyboardSettings);
	const players = new PlayersContent(playersSettings);

	manager.setCommunity(data.word.community);
	manager.setUniqueContent('board', board, boardOptionBtn);
	manager.setUniqueContent('keyboard', keyboard, keyboardOptionBtn);
	manager.setUniqueContent('players', players, playersOptionBtn);
	manager.setMultiContent('about', _ => new AboutContent(aboutSettings), optionBtn);
	manager.showContent();

	const gameSettings = {
		keyboard: keyboard,
		board: board,
		players: players,
		lang: data.word.lang,
		wordLength: data.word.length,
		attempts: data.word.attempts,
		save: data.save,
		actions: {
			submitGuess: word => api.guess(word),
			isComponentAvailable: type => manager.isWindowOpen(type),
			notify: data => manager.notification.show(data),
		}
	};

	const game = new Game(gameSettings);

	manager.setQuitAction(async _ =>
	{
		let draft = await game.getDraft();
		if(draft !== null) await api.exit(draft);
	});
}

setup().catch(error =>
{
	let message = `You have been disconnected from the server.\nReason: "${error.message}.\n\nVisit discord.next21.ru"`;
	manager.showDisconnected(message);
	console.error(error.stack);
});