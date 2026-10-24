import { DiscordDisconnect } from './discord.js'
import AnimationLoading from './animateLoadingProgress.js'
import OptionComponent from './optionComponent.js'
import Notification from './notification.js'

import hoverSound from '../resources/sounds/hover.wav'
import optionClickSound from '../resources/sounds/optionClick.wav'
import logoClickSound from '../resources/sounds/logoClick.wav'

const disconnectedTemplate = document.querySelector('#template-disconnected')
const loadingTemplate = document.querySelector('#template-loading')
const quitTemplate = document.querySelector('#template-quit');
const optionsTemplate = document.querySelector('#template-options');
const optionBtns = document.querySelector('#option-btns');
const quitOptionBtn = document.querySelector('#option-btns .option-quit');
const logo = document.querySelector('#option-btns .mainlogo');

class OptionWindow extends OptionComponent
{
	#TAB_NAMES = ['about', 'keyboard', 'board', 'players'];

	constructor()
	{
		super();

		this.element = optionsTemplate.content.cloneNode(true).firstElementChild;
		this.content = null;
		this.tab = null;

		this._cbTabSelect = null;
		this._cbHideWindow = null;

		this._makeDraggable();
		this._makeResizable();
		this._setHideCallback();
		this._setFocusCallback();

		for(let name of this.#TAB_NAMES)
		{
			const tab = this.element.querySelector(`.tab-${name}`);
			tab.addEventListener('click', _ =>
			{
				if(typeof this._cbTabSelect === 'function') this._cbTabSelect(name);
			});
		}
	}

	initInternal() { if(this.content) this.content.initContent(); }

	setContent(content, tabName)
	{
		this.content = content;
		this.tab = tabName;

		this.element.querySelector('.cs-ui-tab-page').replaceChildren(content.element);

		for(let name of this.#TAB_NAMES)
			this.element.querySelector(`.tab-${name}`).classList.toggle('cs-ui-status-active', name == tabName);
	}

	detachContent()
	{
		const content = this.content;
		if(!content) return null;
		
		if(typeof content.hideInternalComponents === 'function') content.hideInternalComponents();
		content.element.remove();

		this.content = null;
		this.tab = null;

		return content;
	}

	focus()
	{
		super.focus();
		this.show();
	}

	show()
	{
		super.showWindow();
		if(this.content && typeof this.content.showInternalComponents === 'function') this.content.showInternalComponents();
	}

	hide()
	{
		super.hideWindow();
		if(this.content && typeof this.content.hideInternalComponents === 'function') this.content.hideInternalComponents();
	}
}

export default class ComponentManager
{
	#factories = {};
	#UNIQUE_WINDOWS = new Set();
	#MULTI_WINDOWS = new Set();

	#audioHover = null;
	#audioOptionClick = null;
	#audioLogoClick = null;

	#cbQuit = null;

	#pool = [];

	#quitElement = null;
	#suspended = [];
	#isQuitting = false;

	constructor(app)
	{
		this.app = app;
		this.loadingWindow = loadingTemplate.content.cloneNode(true).firstElementChild;

		this.animation = new AnimationLoading(this.loadingWindow);
		this.notification = new Notification();
		this.openWindows = {};
		this.windows = new Set();
		this.contents = {};

		this.windowCascadeX = Math.floor(Math.random() * 5);
		this.windowCascadeY = Math.floor(Math.random() * 5);

		quitOptionBtn.addEventListener('click', _ => this.#showQuit());
		quitOptionBtn.addEventListener('mouseover', _ => this.#playAudio(this.#audioHover));
		logo.addEventListener('click', _ => this.#logoClick());
		logo.addEventListener('mouseover', _ => this.#playAudio(this.#audioHover));

		this.animation.prepare();
		this.showLoading();
		this.#setupAudio();
	}

	#setupAudio()
	{
		const cb = _ =>
		{
			this.#audioHover = new Audio(hoverSound);
			this.#audioOptionClick = new Audio(optionClickSound);
			this.#audioLogoClick = new Audio(logoClickSound);

			document.removeEventListener('click', cb, true);
		};

		document.addEventListener('click', cb, true);
	}

	#playAudio(audio) { if(audio) audio.play(); }

	setCommunity(community = 'classic')
	{
		if(typeof community === 'string')
			if(community) this.app.classList.add(community);
	}

	setQuitAction(callback) { this.#cbQuit = callback; }

	isWindowOpen(type)
	{
		if(this.openWindows[type]) return this.openWindows[type].isVisible;
	}

	setUniqueContent(name, content, optionBtn)
	{
		this.#UNIQUE_WINDOWS.add(name);
		this.contents[name] = content;
		if(optionBtn)
		{
			optionBtn.addEventListener('click', _ => this.openWindow(name));
			optionBtn.addEventListener('mouseover', _ => this.#playAudio(this.#audioHover));
		}
	}

	setMultiContent(name, factory, optionBtn)
	{
		this.#MULTI_WINDOWS.add(name);
		this.#factories[name] = factory;
		if(optionBtn)
		{
			optionBtn.addEventListener('click', _ => this.openWindow(name));
			optionBtn.addEventListener('mouseover', _ => this.#playAudio(this.#audioHover));
		}
	}

	#getContent(type)
	{
		if(!this.#UNIQUE_WINDOWS.has(type)) return this.#factories[type]();
		else return this.contents[type];
	}

	#isUnique(type) { return this.#UNIQUE_WINDOWS.has(type) && !this.#MULTI_WINDOWS.has(type); }

	openWindow(type)
	{
		if(this.#isQuitOpen()) return;
		if(!this.#UNIQUE_WINDOWS.has(type) && !this.#MULTI_WINDOWS.has(type)) return;

		this.#playAudio(this.#audioOptionClick)

		{
			const _window = this.openWindows[type];
			if(_window && this.#isUnique(type)) return _window.focus();
		}

		const _window = this.#createWindow();
		this.#updateWindowsCascade(_window);

		this.app.appendChild(_window.element);
		_window.show();
		this.#assignWindow(_window, type);
		_window.focus();
	}

	#createWindow()
	{
		let _window = this.#pool.pop();

		if(!_window)
		{
			_window = new OptionWindow();
			_window._cbTabSelect = type => this.#selectTab(_window, type);
			_window._cbHideWindow = _ => this.#closeWindow(_window);
		}

		this.windows.add(_window);
		return _window;
	}

	#releaseWindow(_window)
	{
		if(_window.tab && this.openWindows[_window.tab] === _window)
			delete this.openWindows[_window.tab];
		
		let content = _window.detachContent();
		if(content && content.unmountInternalComponents && typeof content.unmountInternalComponents === 'function')
			content.unmountInternalComponents();
	}

	#assignWindow(_window, type)
	{
		this.#releaseWindow(_window);

		let content = this.#getContent(type);

		if(this.#isUnique(type)) this.openWindows[type] = _window;

		_window.setContent(content, type);

		if(_window.content.mountInternalComponents && typeof _window.content.mountInternalComponents === 'function')
			_window.content.mountInternalComponents(this.app);

		_window.initInternal();
	}

	#closeWindow(_window)
	{
		_window.hide();
		this.#releaseWindow(_window);

		_window.element.remove();
		_window.reset();
		this.windows.delete(_window);

		this.#pool.push(_window);
	}

	#selectTab(_window, type)
	{
		if(!this.#UNIQUE_WINDOWS.has(type) && !this.#MULTI_WINDOWS.has(type)) return;
		if(_window.tab == type) return _window.focus();

		{
			const _window = this.openWindows[type];
			if(_window && this.#isUnique(type)) return _window.focus();
		}

		this.#assignWindow(_window, type);
		_window.focus();
	}

	#updateWindowsCascade(_window)
	{
		if(this.windowCascadeY >= 10)
		{
			this.windowCascadeY = Math.floor(Math.random() * 5);
			let cascadeX = Math.floor(Math.random() * 5);
			if(cascadeX == this.windowCascadeX)
				cascadeX = cascadeX == 0 ? cascadeX + 1 : cascadeX - 1;
			this.windowCascadeX = cascadeX;
		}

		const y = this.windowCascadeY++ * 30;
		const x = this.windowCascadeX * Math.max(0, (window.innerWidth - 650) / 5) + y;

		_window.moveTo(x, y);
	}

	showContent()
	{
		this.loadingWindow.remove();
		this.app.classList.add('ready');
	}

	showLoading()
	{
		this.app.replaceChildren(this.loadingWindow);
		this.loadingWindow.querySelector('.cs-ui-button').onclick = DiscordDisconnect;
	}

	showDisconnected(message = '')
	{
		const element = disconnectedTemplate.content.cloneNode(true).firstElementChild;
		if(message) element.querySelector('.status').innerText = message;

		const windows = [...this.windows];
		for(let _window of windows) this.#closeWindow(_window);

		this.#suspended = [];

		this.app.replaceChildren(element);
		element.querySelector('.cs-ui-button').onclick = DiscordDisconnect;
	}

	#isQuitOpen() { return this.#quitElement !== null && this.app.contains(this.#quitElement); }

	#createQuit()
	{
		const element = quitTemplate.content.cloneNode(true).firstElementChild;

		element.querySelector('.btn-quit').onclick = _ => this.#quitGame();
		element.querySelector('.btn-cancel').onclick = _ => this.#hideQuit();

		return element;
	}

	#showQuit()
	{
		if(this.#isQuitOpen()) return;

		this.#audioOptionClick.play();

		if(!this.#quitElement) this.#quitElement = this.#createQuit();

		this.#suspended = OptionComponent.suspendVisible();
		this.app.appendChild(this.#quitElement);
	}

	#hideQuit()
	{
		this.#isQuitting = false;
		this.#quitElement.remove();

		OptionComponent.resume(this.#suspended);
		this.#suspended = [];
	}

	async #quitGame()
	{
		if(this.#isQuitting) return;
		this.#isQuitting = true;

		const savePromise = this.#cbQuit ? this.#cbQuit() : Promise.resolve();

		const racePromise = Promise.race([
			savePromise,
			new Promise(resolve => setTimeout(resolve, 3000))
		]);

		const catchPromise = racePromise.catch(error =>
		{
			DiscordDisconnect();
			throw new Error(error.message)
		});
		await catchPromise.then(() => DiscordDisconnect());
	}

	#logoClick()
	{
		this.#playAudio(this.#audioLogoClick);

		optionBtns.classList.add('instant-hide');
		requestAnimationFrame(_ => optionBtns.classList.remove('instant-hide'));
	}
}