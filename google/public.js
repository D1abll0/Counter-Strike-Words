//DATABASE_SHEET_ID is next value of base sheet https://docs.google.com/spreadsheets/d/__DATABASE_SHEET_ID__/edit
const DATABASE_SHEET_ID = '';
const DATABASE_SHEET_NAME = 'words';

const PUBLIC_SHEET = "public";
const VERIFICATION_SHEET = "verification";
const LANG_COL = 1;
const WORD_COL = 2;
const CHECKBOX_COL = 3;
const START_ROW = 2;

function _onEdit(e)
{
	suggestWord(e);
	addToDB(e);
}

function normalizeWord(word, lang)
{
	if(typeof word != "string") return null;

	const allowedCharCodes = {
		en: code => code >= 65 && code <= 90,
		ru: code => code == 1025 || (code >= 1040 && code <= 1071)
	};

	const _word = word.trim();
	if(!_word) return null;

	let result = '';
	for(let char of _word)
	{
		const letter = char.toUpperCase();
		if(letter.length != 1 || !allowedCharCodes[lang](letter.charCodeAt(0))) return null;
		result += letter;
	}

	return result;
}

function suggestWord(e)
{
	const sheet = e.source.getActiveSheet();
	if(sheet.getName() !== PUBLIC_SHEET) return;

	const range = e.range;
	const row = range.getRow();
	const col = range.getColumn();

	if(row < START_ROW) return;

	const lang = sheet.getRange(row, LANG_COL).getValue();
	const word = sheet.getRange(row, WORD_COL).getValue();
	const checkboxCell = sheet.getRange(row, CHECKBOX_COL);

	const pair = lang.split('-');
	const _lang = pair.length == 1 ? pair[0] : pair[1];

	const _word = normalizeWord(word, _lang);
	if(!_word) return;

	if(col === LANG_COL || col === WORD_COL)
	{
		if(lang !== '' && _word !== '')
		{
			if(checkboxCell.getValue() !== true && checkboxCell.getValue() !== false)
			{
				checkboxCell.insertCheckboxes();
				checkboxCell.setValue(false);
			}
		}
		else
		{
			checkboxCell.clearDataValidations();
			checkboxCell.clearContent();
		}
		return;
	}

	if(col === CHECKBOX_COL && range.getValue() === true)
	{
		if(lang !== '' && _word !== '')
		{
			const target = e.source.getSheetByName(VERIFICATION_SHEET);

			{
				const row = target.getLastRow() + 1;
				target.getRange(row, LANG_COL, 1, 2).setValues([[lang, _word]]);

				const checkboxCell = target.getRange(row, CHECKBOX_COL);
				checkboxCell.insertCheckboxes();
				checkboxCell.setValue(false);
			}

			sheet.getRange(row, LANG_COL, 1, 2).clearContent();
			checkboxCell.clearDataValidations();
			checkboxCell.clearContent();
		}
		else range.setValue(false);
	}
}

function addToDB(e)
{
	const sheet = e.source.getActiveSheet();
	if(sheet.getName() !== VERIFICATION_SHEET) return;

	const range = e.range;
	const row = range.getRow();
	const col = range.getColumn();

	if(row < START_ROW) return;

	if(col !== CHECKBOX_COL || range.getValue() !== true) return;

	const lang = sheet.getRange(row, LANG_COL).getValue();
	const word = sheet.getRange(row, WORD_COL).getValue();

	{
		const targetSpreadsheet = SpreadsheetApp.openById(DATABASE_SHEET_ID);
		const target = targetSpreadsheet.getSheetByName(DATABASE_SHEET_NAME);
		const row = target.getLastRow() + 1;

		target.getRange(row, LANG_COL, 1, 2).setValues([[lang, word]]);
	}

	range.setValue(false);
}