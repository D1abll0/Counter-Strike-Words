const keyboardTemplates = {
	en: document.querySelector('#template-keyboard-latin'),
	ru: document.querySelector('#template-keyboard-cyrillic')
};

export default class Keyboard
{
	constructor(data)
	{
		this.element = keyboardTemplates[data.lang].content.cloneNode(true).firstElementChild;
		this.lang = data.lang;
		this.keys = {};
		this._cbKeyDown = null;

		let _keys = this.element.querySelectorAll('.key');
		for(let i = 0; i < _keys.length; i++)
		{
			let keycode = _keys[i].getAttribute('keycode');
			this.keys[keycode] = {
				tag: _keys[i],
				lastUsedDevice: null
			};

			_keys[i].addEventListener('pointerdown', e =>
			{
				let keycode = e.target.getAttribute('keycode');
				if(this.keys[keycode] && !this.keys[keycode].lastUsedDevice)
				{
					this.keys[keycode].tag.classList.add('active');
					this.keys[keycode].lastUsedDevice = 'mouse';

					if(typeof this._cbKeyDown === 'function') this._cbKeyDown(keycode);
				}
			});
		}

		document.addEventListener('pointerup', e =>
		{
			for(const keycode in this.keys)
			{
				if(this.keys[keycode].lastUsedDevice === 'mouse')
				{
					this.keys[keycode].tag.classList.remove('active');
					this.keys[keycode].lastUsedDevice = null;
				}
			}
		});

		document.addEventListener('keydown', e =>
		{
			if(this.keys[e.keyCode] && !this.keys[e.keyCode].lastUsedDevice)
			{
				this.keys[e.keyCode].tag.classList.add('active')
				this.keys[e.keyCode].lastUsedDevice = 'keyboard';

				if(typeof this._cbKeyDown === 'function') this._cbKeyDown(e.keyCode);
			}
		});

		document.addEventListener('keyup', e => 
		{
			if(this.keys[e.keyCode] && this.keys[e.keyCode].lastUsedDevice == 'keyboard')
			{
				this.keys[e.keyCode].tag.classList.remove('active')
				this.keys[e.keyCode].lastUsedDevice = null;
			}
		});

		window.addEventListener('blur', e =>
		{
			for(const keycode in this.keys)
			{
				if(this.keys[keycode].lastUsedDevice)
				{
					this.keys[keycode].tag.classList.remove('active');
					this.keys[keycode].lastUsedDevice = null;
				}
			}
		});
	}
	
	initContent(){}
}