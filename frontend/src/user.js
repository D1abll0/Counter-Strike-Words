const userTemplate = document.querySelector('#template-user');

export default class User
{
	constructor(data)
	{
		this.element = userTemplate.content.cloneNode(true).firstElementChild;
		this.resultTag = this.element.querySelector('.result');
		this.timeTag = this.element.querySelector('.time');

		this.isFinished = data.isFinished;
		this.isSolved = data.isSolved;

		this.element.querySelector('.avatar').src = data.avatar;
		this.element.querySelector('.name').textContent = data.name;
		this.resultTag.textContent = data.result;
		this.timeTag.textContent = data.time;

		this.wordStatuses = data.statuses;
		this.wordLetters = data.letters || [];
	}
}