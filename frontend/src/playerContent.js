import User from './user.js'
import PlayerAnswers from './playerAnswers.js'
import Scroll from './scroll.js'

const playersTemplate = document.querySelector('#template-players');
const userTemplate = document.querySelector('#template-user');

export default class PlayersContent
{
	#selectedUser = null;
	#resizeObserver = null;
	#userElementHeight = 0;
	#actions = null;

	constructor(data)
	{
		this.element = playersTemplate.content.cloneNode(true).firstElementChild;
		this.body = this.element.querySelector('.players-wrapper #players .body');
		this.updateBtn = this.element.querySelector('.cs-ui-button.update');

		this.answers = new PlayerAnswers(data.words);
		this.#actions = data.actions || {};

		this.scroll = null;
		this.users = {};

		if(
			typeof this.#actions.loadResults !== 'function'
		) throw new Error('Important actions have not been specified.');

		for(let userData of data.users) this.#createUser(userData);

		this.body.addEventListener('click', _ => this.#deselect());
		this.updateBtn.addEventListener('click', async _ => await this.update() );
	}

	initContent()
	{
		if(this.scroll) return this.#resize();

		const cssVar = getComputedStyle(this.body).getPropertyValue('--user-score-height');
		this.#userElementHeight = Number(cssVar.split('px')[0]);

		this.scroll = new Scroll(this.element.querySelector('.cs-ui-scroll'), this.body, this.#userElementHeight);

		this.#resizeObserver = new ResizeObserver(this.#resize.bind(this));
		this.#resizeObserver.observe(this.body);

		this.body.addEventListener('scroll', _ =>
		{
			this.atBottom = this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - 1;
		});
	}

	#resize()
	{
		if(!this.body.clientHeight) return;

		const step = this.#userElementHeight;
		const wasAtBottom = this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - 1;

		this.body.style.marginBottom = '';
		const mb = this.body.clientHeight % step;
		this.body.style.marginBottom = `${mb}px`;

		if(wasAtBottom) this.body.scrollTop = this.body.scrollHeight;
		else this.body.scrollTop = Math.round(this.body.scrollTop / step) * step;

		this.scroll.update();
	}

	mountInternalComponents(app) { app.appendChild(this.answers.element); }

	unmountInternalComponents() { this.answers.element.remove(); }

	showInternalComponents() { this.answers.showWindow(); }

	hideInternalComponents()
	{
		this.answers.hideWindow();
		this.#deselect();
	}

	#select(user)
	{
		if(this.#selectedUser === user) return;

		this.#deselect();
		this.#selectedUser = user;
		user.element.classList.add('selected');

		this.answers.showAnswers(user.wordStatuses, user.wordLetters);
	}

	#deselect()
	{
		if(this.#selectedUser) this.#selectedUser.element.classList.remove('selected');
		this.#selectedUser = null;
		this.answers.clearAnswers();
	}

	#createUser(userData)
	{
		const user = new User(userData);
		this.users[userData.userId] = user;
		user.element.addEventListener('click', e =>
		{
			e.stopPropagation();
			this.#select(user);
		});
		this.body.appendChild(user.element);
	}

	async update(onlyYours = false)
	{
		const response = await this.#actions.loadResults(onlyYours);
		if(response.ok) this.#updateResults(response.data);
		else throw new Error(response.error);
	}

	#updateResults(results)
	{
		for(let userResult of results)
		{
			const user = this.users[userResult.userId];
			if(user)
			{
				if(user.isFinished || user.isSolved) continue;
				
				user.resultTag.textContent = userResult.result;
				user.timeTag.textContent = userResult.time;
				user.isFinished = userResult.isFinished;
				user.isSolved = userResult.isSolved;
				user.wordStatuses = userResult.statuses;
				user.wordLetters = userResult.letters;

				if(this.#selectedUser === user) this.answers.showAnswers(user.wordStatuses, user.wordLetters);
			}
			else this.#createUser(userResult);
		}

		if(this.scroll) this.scroll.update();
	}
}