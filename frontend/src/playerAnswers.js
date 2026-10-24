import OptionComponent from './optionComponent.js'

const answersTemplate = document.querySelector('#template-answers');
const answerCellTemplate = document.querySelector('#template-answer-cell');

export default class PlayerAnswers extends OptionComponent
{
	constructor(data)
	{
		super();

		this.element = answersTemplate.content.cloneNode(true).firstElementChild;
		this.element.style.setProperty('--rows', data.attempts);
		this.element.style.setProperty('--cols', data.wordLength);

		this.cells = [];

		let container = this.element.querySelector('.cs-ui-container');

		for(let i = 0; i < data.wordLength * data.attempts; i++)
		{
			let cell = answerCellTemplate.content.cloneNode(true).firstElementChild;
			container.appendChild(cell);
		}

		this.cells = container.querySelectorAll('.cell');

		this._makeDraggable();
		this._setFocusCallback();
	}

	clearAnswers()
	{
		for(let i = 0; i < this.cells.length; i++)
		{
			this.cells[i].classList.remove('correct');
			this.cells[i].classList.remove('present');
			this.cells[i].classList.remove('absent');

			this.cells[i].textContent = '';
		}
	}

	showAnswers(statuses, letters)
	{
		this.clearAnswers();

		for(let i = 0; i < this.cells.length; i++)
		{
			if(statuses[i] == 'c') this.cells[i].classList.add('correct');
			if(statuses[i] == 'p') this.cells[i].classList.add('present');
			if(statuses[i] == 'a') this.cells[i].classList.add('absent');
			if(letters) this.cells[i].textContent = letters[i];
		}
	}
}