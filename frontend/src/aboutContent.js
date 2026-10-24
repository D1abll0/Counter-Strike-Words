const aboutTemplate = document.querySelector('#template-about');

export default class AboutContent
{
	constructor(data)
	{
		this.element = aboutTemplate.content.cloneNode(true).firstElementChild;
		this.element.querySelector('p.date').innerText = data.date;
		this.element.querySelector('p.issue_number').innerText = data.issueNumber;
	}

	initContent(){}
}