export default class OptionComponent
{
	static instances = new Set();

	static suspendVisible()
	{
		const suspended = [];
		for(const instance of OptionComponent.instances)
		{
			if(!instance.isVisible) continue;
			instance.hideWindow();
			suspended.push(instance);
		}
		return suspended;
	}

	static resume(suspended)
	{
		for(const instance of suspended)
			if(OptionComponent.instances.has(instance) && instance.element.isConnected) instance.showWindow();
	}

	constructor()
	{
		this.isVisible = false;
		this.isDragging = false;

		this.moveLastX = 0;
		this.moveLastY = 0;
		this.moveX = 0;
		this.moveY = 0;

		this.resizeStartX = 0;
		this.resizeStartY = 0;
		this.resizeStartWidth = 0;
		this.resizeStartHeight = 0;

		this._cbResize = this.#resize.bind(this);
		this._cbStopResize = this.#stopResize.bind(this);

		this.emitDraggable = null;
		this.emitResizable = null;

		OptionComponent.instances.add(this);
	}

	_setHideCallback()
	{
		this.element.querySelector('.cs-ui-button.close').onclick = _ =>
		{
			if(typeof this._cbHideWindow === 'function') this._cbHideWindow();
		};
	}

	_setFocusCallback()
	{
		this.element.addEventListener('pointerdown', _ => this.focus());
	}

	moveTo(x, y)
	{
		this.moveX = Math.round(x);
		this.moveY = Math.round(y);
		this.element.style.transform = `translate3d(${this.moveX}px, ${this.moveY}px, 0px)`;
	}

	_makeDraggable()
	{
		let _draggable = this.element.querySelector('.dragger');
		if(!_draggable) return;

		_draggable.addEventListener('pointerdown', e =>
		{
			if(e.target.classList.contains('cs-ui-button')) return;

			e.preventDefault();

			this.isDragging = true;
			this.moveLastX = e.clientX;
			this.moveLastY = e.clientY;
			_draggable.setPointerCapture(e.pointerId);
		});

		_draggable.addEventListener('pointermove', e =>
		{
			if(!this.isDragging) return;

			if(e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) return;

			let dx = e.clientX - this.moveLastX;
			let dy = e.clientY - this.moveLastY;

			this.moveLastX = e.clientX;
			this.moveLastY = e.clientY;

			this.moveTo(this.moveX + dx, this.moveY + dy);

			if(typeof this.emitDraggable === 'function') this.emitDraggable();
		});

		_draggable.addEventListener('pointerup', e => this.#stopDrag(_draggable, e.pointerId) );
		_draggable.addEventListener('pointercancel', e => this.#stopDrag(_draggable, e.pointerId) );
	}

	#stopDrag(draggable, pointerId)
	{
		this.isDragging = false;
		if(draggable.hasPointerCapture(pointerId))
			draggable.releasePointerCapture(pointerId);
	}

	_makeResizable()
	{
		let _resizable = this.element.querySelector('.cs-ui-window-resize');
		if(!_resizable) return;

		_resizable.addEventListener('pointerdown', e =>
		{
			e.preventDefault();

			this.resizeStartX = e.clientX;
			this.resizeStartY = e.clientY;
			this.resizeStartWidth = this.element.offsetWidth;
			this.resizeStartHeight = this.element.offsetHeight;

			_resizable.setPointerCapture(e.pointerId);

			document.addEventListener('pointermove', this._cbResize);
			document.addEventListener('pointerup', this._cbStopResize);
			document.addEventListener('pointercancel', this._cbStopResize);
		});
	}

	#resize(e)
	{
		if(e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) return;
		
		const width = Math.round(this.resizeStartWidth + (e.clientX - this.resizeStartX));
		const height = Math.round(this.resizeStartHeight + (e.clientY - this.resizeStartY));

		this.element.style.width = `${width}px`;
		this.element.style.height = `${height}px`;

		if(typeof this.emitResizable === 'function') this.emitResizable();
	}

	#stopResize()
	{
		document.removeEventListener('pointermove', this._cbResize);
		document.removeEventListener('pointerup', this._cbStopResize);
		document.removeEventListener('pointercancel', this._cbStopResize);
	}

	minimize(){}

	focus()
	{
		OptionComponent.instances.delete(this);
		OptionComponent.instances.add(this);

		let z = 1;
		for(let instance of OptionComponent.instances)
		{
			instance.element.classList.remove('active');
			instance.element.style.zIndex = z;
			z++;
		}
		this.element.classList.add('active');
	}

	showWindow()
	{
		this.element.style.display = 'flex';
		this.isVisible = true;
	}

	hideWindow()
	{
		this.element.style.display = 'none';
		this.isVisible = false;

		this.isDragging = false;
		this._cbStopResize();
	}

	reset()
	{
		this.isDragging = false;
		this.element.classList.remove('active');
		this.element.style.width = '';
		this.element.style.height = '';
		this.element.style.zIndex = '';
	}

	dispose() { OptionComponent.instances.delete(this); }
}