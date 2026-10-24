export default class Scroll
{
	constructor(scrollElement, containerElement, step = 1)
	{
		this.scroll = scrollElement;
		this.track = this.scroll.querySelector('.cs-ui-scroll-track');
		this.thumb = this.scroll.querySelector('.cs-ui-scroll-thumb');
		this.btnT = this.scroll.querySelector('.cs-ui-scroll-btn-top');
		this.btnB = this.scroll.querySelector('.cs-ui-scroll-btn-bottom');

		this.container = containerElement;

		this.SCROLL_STEP = step;

		this.thumbBordersTotal = 0;

		this.timerId = null;
		this.intervalId = null;

		this.scrollTop = 0;
		this.thumbStartY = 0;
		this.thumbActive = false;

		this._cbOnPointerMove = this.#cbOnPointerMove.bind(this);
		this._cbOnPointerUp = this.#cbOnPointerUp.bind(this);

		this._cbOnResize = this.update.bind(this);
		this._resizeObserver = new ResizeObserver(this._cbOnResize);

		this.#init();
	}

	#init()
	{
		const styles = getComputedStyle(this.thumb);
		const top = parseFloat(styles.borderTopWidth) || 0;
		const bottom = parseFloat(styles.borderBottomWidth) || 0;
		this.thumbBordersTotal = top + bottom;

		/*pressing*/
		this.track.addEventListener('pointerdown', e =>
		{
			if(e.target === this.thumb) return;

			const ratio = e.offsetY / this.track.clientHeight;
			const maxScroll = this.container.scrollHeight - this.container.clientHeight;
			const position = Math.round(this.container.scrollHeight * ratio / this.SCROLL_STEP) * this.SCROLL_STEP;

			this.container.scrollTo(0, position);
		});

		this.btnT.addEventListener('pointerdown', this.#cbHandlePointerDown.bind(this, -1));
		this.btnT.addEventListener('pointerup', this.#stopTimers.bind(this));
		this.btnT.addEventListener('pointercancel', this.#stopTimers.bind(this));
		this.btnT.addEventListener('pointerleave', this.#stopTimers.bind(this));

		this.btnB.addEventListener('pointerdown', this.#cbHandlePointerDown.bind(this, 1));
		this.btnB.addEventListener('pointerup', this.#stopTimers.bind(this));
		this.btnB.addEventListener('pointercancel', this.#stopTimers.bind(this));
		this.btnB.addEventListener('pointerleave', this.#stopTimers.bind(this));		

		/*scrolling*/
		this.scroll.addEventListener('wheel', this.#doScroll.bind(this), {passive: false});
		this.container.addEventListener('wheel', this.#doScroll.bind(this), {passive: false});
		this.container.addEventListener('scroll', _ => this.#updateThumb());

		/*dragging*/
		this.thumb.addEventListener('pointerdown', e =>
		{
			e.preventDefault();

			this.thumbActive = true;
			this.thumbStartY = e.clientY;
			this.scrollTop = this.container.scrollTop;
		});

		document.addEventListener('pointermove', this._cbOnPointerMove);
		document.addEventListener('pointerup', this._cbOnPointerUp);
		document.addEventListener('pointercancel', this._cbOnPointerUp);

		this._resizeObserver.observe(this.container);
		this.update();
	}

	#cbOnPointerMove(e)
	{
		if (!this.thumbActive) return;

		e.preventDefault();

		const trackHeight = this.track.clientHeight - this.thumb.clientHeight;
		const scrollRange = this.container.scrollHeight - this.container.clientHeight;
		const deltaY = e.clientY - this.thumbStartY;
		const ratio = scrollRange / trackHeight;
		const rawScroll = this.scrollTop + deltaY * ratio;

		this.container.scrollTop = Math.round(rawScroll / this.SCROLL_STEP) * this.SCROLL_STEP;
	}

	#cbOnPointerUp() { this.thumbActive = false; }

	#cbHandlePointerDown(direction)
	{
		const cb = _ => this.#scrollBy(direction, 1);
		cb();

		this.timerId = setTimeout(_ => this.intervalId = setInterval(cb, 100), 300);
	}

	#stopTimers()
	{
		clearTimeout(this.timerId);
		clearInterval(this.intervalId);
		
		this.timerId = null;
		this.intervalId = null;
	}

	#doScroll(e)
	{
		e.preventDefault();

		const isAtBottom = this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight;
		const direction = Math.sign(e.deltaY);

		if(direction == -1 && !this.container.scrollTop) return;
		if(direction == 1 && isAtBottom) return;

		this.#scrollBy(direction, 3);
	}

	#scrollBy(direction, count)
	{
		this.container.scrollBy(
		{
			top: direction * count * this.SCROLL_STEP,
			behavior: 'instant'
		});
	}

	#updateThumb()
	{
		const maxScroll = this.container.scrollHeight - this.container.clientHeight;
		const progress = maxScroll > 0 ? this.container.scrollTop / maxScroll : 0;
		const maxThumbPosition = this.track.clientHeight - this.thumb.clientHeight - this.thumbBordersTotal;
		const y = Math.round(progress * maxThumbPosition);

		this.thumb.style.transform = `translate3d(0px, ${y}px, 0px)`;
	}

	update()
	{
		const proportion = this.container.clientHeight / this.container.scrollHeight;
		const height = (this.track.clientHeight - this.thumbBordersTotal) * proportion;
		this.thumb.style.height = `${height}px`;

		if(this.container.offsetHeight == this.container.scrollHeight) this.thumb.style.display = 'none';
		else
		{
			this.thumb.style.display = 'block';
			this.#updateThumb();
		}
	}
}