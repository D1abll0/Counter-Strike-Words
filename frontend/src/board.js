const boardTemplate = document.querySelector('#template-board');
const boardCellTemplate = document.querySelector('#template-board-cell');

export default class Board
{
	constructor(data)
	{
		this.element = boardTemplate.content.cloneNode(true).firstElementChild;
		this.cells = [];

		let board = this.element.querySelector('#board');
		board.style.setProperty('--rows', data.attempts);
		board.style.setProperty('--cols', data.wordLength);

		for(let i = 0; i < data.wordLength * data.attempts; i++)
		{
			let cell = boardCellTemplate.content.cloneNode(true).firstElementChild;

			board.appendChild(cell);
			this.cells.push(cell);
		}
	}

	initContent(){}
}