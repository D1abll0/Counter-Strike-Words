function doGet(e)
{
	//pageId is next value https://docs.google.com/spreadsheets/d/__pageId__/edit
	const pageId = '';
	const sheet = SpreadsheetApp.openById(pageId).getSheetByName('words');

	const lastRow = sheet.getLastRow();
	let result = [['n21-en', 'zed']];

	if(lastRow > 1) result = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

	return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}