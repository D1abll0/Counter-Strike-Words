const ALPHABET = {
	en: { 65: "a", 66: "b", 67: "c", 68: "d", 69: "e", 70: "f", 71: "g", 72: "h", 73: "i", 74: "j", 75: "k", 76: "l", 77: "m", 78: "n", 79: "o", 80: "p", 81: "q", 82: "r", 83: "s", 84: "t", 85: "u", 86: "v", 87: "w", 88: "x", 89: "y", 90: "z"},
	ru: { 65: "ф", 66: "и", 67: "с", 68: "в", 69: "у", 70: "а", 71: "п", 72: "р", 73: "ш", 74: "о", 75: "л", 76: "д", 77: "ь", 78: "т", 79: "щ", 80: "з", 81: "й", 82: "к", 83: "ы", 84: "е", 85: "г", 86: "м", 87: "ц", 88: "ч", 89: "н", 90: "я", 186: "ж", 188: "б", 190: "ю", 192: "ё", 219: "х", 221: "ъ", 222: "э"}
};

const KEYCODE_ENTER = 13;
const KEYCODE_REMOVE = 8;

export default class Game
{
	#actions = null;
	#isBusy = false;
	#pending = null;
	#savedDraft = '';

	constructor(data)
	{
		this.word = '';
		this.lang = data.lang;
		this.wordLength = data.wordLength;
		this.attempts = data.attempts;
		this.keyCodes = [];
		this.rowIndex = 0;
		this.isFinished = false;
		this.isSolved = false;
		this.board = data.board;
		this.keyboard = data.keyboard
		this.players = data.players;

		this.keyboard._cbKeyDown = this.processKey.bind(this);
		this.#actions = data.actions || {};

		if(
			typeof this.#actions.isComponentAvailable !== 'function' || 
			typeof this.#actions.submitGuess !== 'function' ||
			typeof this.#actions.notify !== 'function'
		) throw new Error('Important actions have not been specified.');

		if(data.save) this.#loadSave(data.save);
	}

	#loadSave(save)
	{
		for(let i = 0; i < save.statuses.length; i++)
		{
			let _class = '';
			if(save.statuses[i] == 'c') _class = 'correct';
			if(save.statuses[i] == 'p') _class = 'present';
			if(save.statuses[i] == 'a') _class = 'absent';

			this.board.cells[i].classList.add(_class);

			let keyClassList = this.keyboard.keys[save.keyCodes[i]].tag.classList;
			if(_class == 'correct') keyClassList.remove('present');
			if(!keyClassList.contains('correct')) keyClassList.add(_class);
		}

		for(let i = 0; i < save.words.length; i++)
			this.board.cells[i].textContent = save.words[i].toUpperCase();

		for(let i = save.usedAttempts * this.wordLength; i < save.words.length; i++)
		{
			this.word += save.words[i];
			this.keyCodes.push(save.keyCodes[i]);
		}

		this.rowIndex = save.usedAttempts;
		this.isFinished = save.isFinished;
		this.isSolved = save.isSolved;
		this.#savedDraft = this.word;
	}

	async processKey(keycode)
	{
		if(!this.#actions.isComponentAvailable('board') || !this.#actions.isComponentAvailable('keyboard'))
			throw new Error('Basic components are not available.');

		if(this.#isBusy)
		{
			this.#actions.notify({
				class: 'warning',
				header: 'Your word is being sent',
				body: "Your last word hasn't been delivered yet. Please wait a moment."
			});
			return;
		}

		if(this.isFinished && this.isSolved)
		{
			this.#actions.notify({
				class: 'info',
				header: 'You solved it!',
				body: 'Come back tomorrow for a new word. For now, you can view the results in the Players tab.'
			});
			return;
		}

		if(this.isFinished && !this.isSolved)
		{
			this.#actions.notify({
				class: 'warning',
				header: 'Game over',
				body: 'You ran out of attempts. Try again tomorrow. You can still view the results in the Players tab.'
			});
			return;
		}

		if(keycode == KEYCODE_ENTER)
		{
			if(this.word.length == this.wordLength)
			{
				this.#isBusy = true;

				this.#pending = this.#actions.submitGuess(this.word);
				let response = await this.#pending;
				if(response.ok)
				{
					this.#cbProcessAnswer(response.data);
					this.players.update(false);
				}
				else
				{
					this.#isBusy = false;
					throw new Error(response.error);
				}

				this.#isBusy = false;
			}
		}
		else if(keycode == KEYCODE_REMOVE)
		{
			if(this.word.length > 0)
			{				
				this.board.cells[this.rowIndex * this.wordLength + this.word.length - 1].textContent = '';
				this.word = this.word.slice(0, -1);
				this.keyCodes = this.keyCodes.slice(0, -1);
			}
		}
		else
		{
			if(this.word.length < this.wordLength)
			{
				let letter = ALPHABET[this.lang][keycode].toUpperCase();
				this.board.cells[this.rowIndex * this.wordLength + this.word.length].textContent = letter;
				this.word += letter;
				this.keyCodes.push(keycode);
			}
		}
	}

	async getDraft()
	{
		if(this.#pending) await this.#pending;
		if(this.isFinished || this.word == this.#savedDraft) return null;
		return this.word;
	}

	#cbProcessAnswer(response)
	{
		for(let i = 0; i < response.statuses.length; i++)
		{
			let _class = '';
			if(response.statuses[i] == 'c') _class = 'correct';
			if(response.statuses[i] == 'p') _class = 'present';
			if(response.statuses[i] == 'a') _class = 'absent';

			let cellIndex = response.usedAttempts * response.statuses.length + i;

			this.board.cells[cellIndex].textContent = response.word[i];
			this.board.cells[cellIndex].classList.add(_class);

			let keycode = this.keyCodes[i];
			let keyClassList = this.keyboard.keys[keycode].tag.classList;
			if(_class == 'correct') keyClassList.remove('present');
			if(!keyClassList.contains('correct')) keyClassList.add(_class);
		}

		this.rowIndex = response.usedAttempts + 1;
		this.isFinished = response.isFinished;
		this.isSolved = response.isSolved;

		this.word = '';
		this.keyCodes = [];
		this.#savedDraft = '';
	}
}