const SETTINGS = {
	layoutGap: 10,
	cardCell: 15,			// cell size
	cardGap: 2,				// gap between cells (pitch = cell + gap = 17)
	cardPad: 7,				// equal padding inside all panels (avatar, answers, username)
	cardAvatarGap: 12,		// gap between the avatar panel and the answers panel
	cardMargin: 8,			// outer margin
	cardNameFontSize: 50,	// max font size of the username
	cardNameMinFontSize: 20,
	cardNameMaxWidth: 420,	// the username shrinks to fit this width; below the min font size the image gets wider
	cardNameGap: 12,		// gap between the card and the username panel
	cardNamePad: 6			// padding between the username and the edge of its dark field
};

const COLORS = {
	background: '#4c5844',
	panel: '#4c5844',
	answerPanel: '#3e4637',
	light: '#868e80',
	dark: '#282e22',
	cellEmpty: '#282828',
	c: '#446d00',
	p: '#5f6100',
	a: '#6b0700',
	textC: '#9fff00',
	textP: '#faff00',
	textA: '#ff1100',
	name: '#fff'
};

const CARD_FONT = 'Tahoma, Verdana, DejaVu Sans, sans-serif';
const CARD_LETTER_SIZE = 12;

function place(card, x, y)
{
	const body = card.body ?? card.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
	return `<g transform="translate(${x} ${y})">${body}</g>`;
}
 
export function buildTopSVG(cards, mode)
{
	let width = 0;
	let height = 0;
	let inner = '';
 
	if(mode == 'row')
	{
		let x = 0;
		for(const card of cards)
		{
			inner += place(card, x, 0);
			x += card.width + SETTINGS.layoutGap;
			height = Math.max(height, card.height);
		}
		width = x - SETTINGS.layoutGap;
	}
 	
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${COLORS.background}"/>${inner}</svg>`

	return {svg, width,	height};
}

function escapeXml(str)
{
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bevel(x, y, w, h, topLeft, bottomRight)
{
	return `<path d="M${x} ${y + h}V${y}H${x + w}" fill="none" stroke="${topLeft}" stroke-width="1"/>` +
		`<path d="M${x + w} ${y}V${y + h}H${x}" fill="none" stroke="${bottomRight}" stroke-width="1"/>`;
}

export function buildPlayerCardSVG(data)
{
	const pitch = SETTINGS.cardCell + SETTINGS.cardGap;

	const frameWidth = data.wordLength * pitch + SETTINGS.cardGap + 2;
	const frameHeight = data.attempts * pitch + SETTINGS.cardGap + 2;

	const avatarSize = frameHeight;
	const panelHeight = frameHeight + SETTINGS.cardPad * 2;
	const avatarPanelWidth = avatarSize + SETTINGS.cardPad * 2;
	const panelWidth = frameWidth + SETTINGS.cardPad * 2;

	const name = String(data.username);
	const nameLength = Array.from(name).length;

	const nameFontSize = Math.max(SETTINGS.cardNameMinFontSize, Math.min(SETTINGS.cardNameFontSize, Math.floor(SETTINGS.cardNameMaxWidth / (nameLength * 0.68))));

	const nameWidth = Math.ceil(nameLength * nameFontSize * 0.68);

	const cardWidth = avatarPanelWidth + SETTINGS.cardAvatarGap + panelWidth;
	const cardHeight = panelHeight;

	const nameFrameWidth = Math.max(cardWidth - SETTINGS.cardPad * 2, nameWidth + SETTINGS.cardNamePad * 2 + 2);
	const nameFrameHeight = Math.ceil(SETTINGS.cardNameFontSize * 1.2) + SETTINGS.cardNamePad * 2 + 2;
	const namePanelWidth = nameFrameWidth + SETTINGS.cardPad * 2;
	const namePanelHeight = nameFrameHeight + SETTINGS.cardPad * 2;

	const width = Math.max(cardWidth, namePanelWidth) + SETTINGS.cardMargin * 2;
	const height = SETTINGS.cardMargin + cardHeight + SETTINGS.cardNameGap + namePanelHeight + SETTINGS.cardMargin;

	const cardX = Math.round((width - cardWidth) / 2);
	const cardY = SETTINGS.cardMargin;

	const panelX = cardX + avatarPanelWidth + SETTINGS.cardAvatarGap;
	const frameX = panelX + SETTINGS.cardPad;
	const frameY = cardY + SETTINGS.cardPad;
	const avatarX = cardX + SETTINGS.cardPad;
	const avatarY = cardY + SETTINGS.cardPad;

	const namePanelX = Math.round((width - namePanelWidth) / 2);
	const namePanelY = cardY + cardHeight + SETTINGS.cardNameGap;
	const nameFrameX = namePanelX + SETTINGS.cardPad;
	const nameFrameY = namePanelY + SETTINGS.cardPad;

	let svg = `<rect width="${width}" height="${height}" fill="${COLORS.background}"/>`;

	svg += `<rect x="${cardX}" y="${cardY}" width="${avatarPanelWidth}" height="${panelHeight}" fill="${COLORS.panel}"/>`;
	svg += bevel(cardX + 0.5, cardY + 0.5, avatarPanelWidth - 1, panelHeight - 1, COLORS.light, COLORS.dark);
	svg += `<image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid slice" xlink:href="${data.avatarHref}"/>`;
	svg += bevel(avatarX + 0.5, avatarY + 0.5, avatarSize - 1, avatarSize - 1, COLORS.dark, COLORS.light);

	svg += `<rect x="${panelX}" y="${cardY}" width="${panelWidth}" height="${panelHeight}" fill="${COLORS.panel}"/>`;
	svg += bevel(panelX + 0.5, cardY + 0.5, panelWidth - 1, panelHeight - 1, COLORS.light, COLORS.dark);

	svg += `<rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" fill="${COLORS.answerPanel}"/>`;
	svg += bevel(frameX + 0.5, frameY + 0.5, frameWidth - 1, frameHeight - 1, COLORS.dark, COLORS.light);

	for(let row = 0; row < data.attempts; row++)
	{
		for(let col = 0; col < data.wordLength; col++)
		{
			const status = data.statuses[row * data.wordLength + col];
			const color = COLORS[status] || COLORS.cellEmpty;
			const x = frameX + 1 + SETTINGS.cardGap + col * pitch;
			const y = frameY + 1 + SETTINGS.cardGap + row * pitch;
			svg += `<rect x="${x}" y="${y}" width="${SETTINGS.cardCell}" height="${SETTINGS.cardCell}" fill="${color}"/>`;

			const letter = data.letters[row * data.wordLength + col];
			if(letter && status)
			{
				const textColor = COLORS['text' + status[0].toUpperCase() + status.slice(1)];
				svg += `
				<text x="${x + SETTINGS.cardCell / 2}" y="${y + SETTINGS.cardCell / 2 + CARD_LETTER_SIZE * 0.35}" text-anchor="middle" font-family="${CARD_FONT}" font-size="${CARD_LETTER_SIZE}" fill="${textColor}">${escapeXml(String(letter).toUpperCase())}</text>`;
			}
		}
	}

	svg += `<rect x="${namePanelX}" y="${namePanelY}" width="${namePanelWidth}" height="${namePanelHeight}" fill="${COLORS.panel}"/>`;
	svg += bevel(namePanelX + 0.5, namePanelY + 0.5, namePanelWidth - 1, namePanelHeight - 1, COLORS.light, COLORS.dark);
	svg += `<rect x="${nameFrameX}" y="${nameFrameY}" width="${nameFrameWidth}" height="${nameFrameHeight}" fill="${COLORS.answerPanel}"/>`;
	svg += bevel(nameFrameX + 0.5, nameFrameY + 0.5, nameFrameWidth - 1, nameFrameHeight - 1, COLORS.dark, COLORS.light);
	svg += `<text x="${nameFrameX + nameFrameWidth / 2}" y="${nameFrameY + nameFrameHeight / 2 + nameFontSize * 0.35}" text-anchor="middle" font-family="${CARD_FONT}" font-size="${nameFontSize}" fill="${COLORS.name}" fill-opacity="0.32">${escapeXml(name)}</text>`;

	const body = svg;
	svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
	return {svg, body, width, height};
}