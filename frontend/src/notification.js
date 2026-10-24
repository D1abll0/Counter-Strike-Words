export default class Notification
{
	#timer = null;
	#timeout = 4000;

	constructor()
	{
		this.element = document.querySelector('#notification');
		this.header = this.element.querySelector('.header');
		this.body = this.element.querySelector('.body');
		this.element.style.display = 'none';
	}

	show(data)
	{
		if(this.header.textContent == data.header) return;
		
		this.hide();

		this.element.style.display = 'flex';
		this.element.classList.add(data.class);
		this.header.textContent = data.header;
		this.body.textContent = data.body;

		this.#timer = setTimeout(_ => this.hide(), this.#timeout);
	}

	hide()
	{
		this.element.classList.remove('info', 'warning');
		this.header.textContent = '';
		this.body.textContent = '';
		this.element.style.display = 'none';

		if(this.#timer !== null) clearTimeout(this.#timer);
	}
}