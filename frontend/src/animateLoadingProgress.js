import { CONNECTION_STATUSES, CONNECTION_STATUSES_MANDATORY, CONNECTION_STATUSES_N21, CONNECTION_STATUSES_WARZONE_MANDATORY } from './loadingStatusMessages.js';

export default class AnimationLoading
{
	#maxProgressItemsCount = 25;

	constructor(element)
	{
		this.element = element;
		this.statusTag = null;
		this.count = 0;
		this.config = null;
		this.timeoutID = null;
		this.status = '';
		this.statusIndex = 0;
		this._animate = this._animate.bind(this);
	}

	prepare()
	{
		this.statusTag = this.element.querySelector('.status');
		this.element.style.setProperty('--outer-max-progress-items-count', this.#maxProgressItemsCount);
	}

	_animate(resolve)
	{
		this._getStatusMessage();
		this.statusTag.textContent = this.status;

		this.element.style.setProperty('--outer-progress-items-count', this.count++);

		if(this.count > this.config.maxProgress)
		{
			resolve();
			return;
		}

		this.timeoutID = setTimeout(this._animate, this.config.delay, resolve);
	}

	run(phase)
	{
		if(phase == 1 || this.count >= this.#maxProgressItemsCount) this.count = 0;
		this._getConfig(phase);

		return new Promise(resolve => this._animate(resolve) );
	}

	stop()
	{
		clearTimeout(this.timeoutID);
		this.timeoutID = null;
	}

	_getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

	_getMaxProgress()
	{
		const rand = Math.random();
		if(rand > 0.99) return 24;
		if(rand > 0.7) return 10 + Math.floor(Math.random() * 5);
		if(rand > 0.35) return Math.floor(Math.random() * 10);
		return 1 + Math.floor(Math.random() * 5);
	}

	_getConfig(phase)
	{
		const CONFIG = {
			1: {
				maxProgress: this._getMaxProgress(),
				get delay()
				{
					let delay = 100 + Math.random() * 400;
					if(Math.random() > 0.9) delay += 1000 + Math.random() * 500;
					return delay;
				}
			},
			2: {
				maxProgress: 25,
				get delay() { return 50 + Math.random() * 100; }
			}
		};

		if(CONFIG[phase]) this.config = CONFIG[phase];
	}

	_getStatusMessage()
	{
		if(this.status === 'The Warzone is being developed...')
			this.status = this._getRandomElement(CONNECTION_STATUSES_WARZONE_MANDATORY);
		else if(Math.random() > 0.98)
			this.status = this._getRandomElement(CONNECTION_STATUSES_N21);
		else if(Math.random() > 0.5 || !this.status)
		{
			if(this.statusIndex >= CONNECTION_STATUSES.length)
				this.status = this._getRandomElement(CONNECTION_STATUSES_MANDATORY);
			else this.status = CONNECTION_STATUSES[this.statusIndex++];
		}
	}
}