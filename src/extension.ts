// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HoverProvider, TextDocument, Position, CancellationToken, Hover, DefinitionProvider, Definition, ProviderResult, Range } from 'vscode';
import { URL } from 'url';

import request = require('request');
import htmlparser = require('htmlparser2');
import HtmlTableToJson = require('html-table-to-json');
import xpath = require('xpath');
import xmldom = require('xmldom');

const STEP_MODE: vscode.DocumentFilter = { language: 'step', scheme: 'file' };
const NOT_DIG_REGEXP = new RegExp(/\D/);

const IFC_SCHEMA_URL = {
	'IFC2X3': [
		new URL('http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_selecttype.htm'),
		new URL('http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_enumtype.htm'),
		new URL('http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_definedtype.htm'),
		new URL('http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_entities.htm')
	],
	'IFC4': [new URL('http://www.buildingsmart-tech.org/ifc/IFC4/final/html/toc.htm')],
	'IFC4X1': [new URL('http://www.buildingsmart-tech.org/ifc/IFC4x1/final/html/toc.htm')]
};

var CURRENT_SCHEMA = '';

const REQUEST_HEADER = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:64.0) Gecko/20100101 Firefox/64.0',
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'DNT': 1,
	'Connection': 'keep-alive',
	'Pragma': 'no-cache',
	'Cache-Control': 'no-cache'
};

function getStepReferenceIdFromDocument(document: TextDocument, position: Position): string {
	let wordAtPosition = document.getWordRangeAtPosition(position, /#[0-9]+/);
	if (wordAtPosition) {
		let referenceIdText = document.getText(wordAtPosition);
		if (referenceIdText.length > 1 && referenceIdText.startsWith('#')) {
			return referenceIdText;
		}
	}
	return '';
}

function getTypeNameFromDocument(document: TextDocument, position: Position): string {
	let wordAtPosition = document.getWordRangeAtPosition(position, /[0-9a-zA-Z_]+\s*\(/);
	if (wordAtPosition) {
		let typeName = document.getText(wordAtPosition);
		if (typeName.length > 1) {
			return typeName.replace(/\s*\(/, '');
		}
	}
	return '';
}

function getSchemaFromDocument(document: TextDocument): string {
	let headerLineNum = 0;
	for (let index = 0; index < document.lineCount; index++) {
		let line = document.lineAt(index);
		if (line.text.indexOf('ENDSEC;') != -1) {
			headerLineNum = index;
			break;
		}
	}
	if (headerLineNum != 0) {
		let headerEnd = document.lineAt(headerLineNum - 1).range.end;
		let headerText = document.getText(new vscode.Range(new Position(0, 0), headerEnd));
		let headLines = headerText.split(/;/g);
		for (let i = 0; i < headLines.length; i++) {
			if (headLines[i].indexOf('FILE_SCHEMA') != -1) {
				let schemaLine = headLines[i].replace(/\r?\n/g, '');
				let matches = schemaLine.match(/(\s*\(\s*){2}'(.*)'(\s*\)\s*){2}/);
				if (matches.length == 4) {
					return matches[2];
				}
			}
		}
	}
	return '';
}

function getIfcSchemaUrls(schema?: string): URL[] {
	let schemaUrls = IFC_SCHEMA_URL['IFC4X1'];
	if (schema != undefined && schema != '') {
		if (schema.startsWith('IFC2X3')) {
			schemaUrls = IFC_SCHEMA_URL['IFC2X3'];
		} else if (schema === 'IFC4') {
			schemaUrls = IFC_SCHEMA_URL['IFC4'];
		}
	}
	return schemaUrls;
}

async function getIfcTypeHrefFromHtml(content: string, typeName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let parser = new htmlparser.Parser({
			onopentag: (name, attr) => {
				if (name == 'a' && attr.href.endsWith(`${typeName.toLowerCase()}.htm`)) {
					parser.end();
								rev(new URL(attr.href, schemaUrls[index]).href);
							}
						}
					});
					parser.write(body);
					parser.end();
	});
}

async function getIfcTypeHyperLink(typeName: string, schema?: string): Promise<string> {
	let schemaUrls = getIfcSchemaUrls(schema);
	return new Promise<string>((rev, rej) => {
		for (let index = 0; index < schemaUrls.length; index++) {
			request(schemaUrls[index].href, async (error, response, body) => {
				if (error) {
					rej(`error: ${error}; response: ${response}`);
				} else {
					rev(new URL(await getIfcTypeHrefFromHtml(body, typeName), schemaUrls[index]).href);
				}
			});
		}
	});
}

function getIfc4x1EntityAttributeMarkdownString(ifcUrl: URL): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let md = `[goto schema page](${ifcUrl.href})  \n`;
		request({ url: ifcUrl.href, headers: REQUEST_HEADER }, (error, response, body) => {
			if (error) {
				resolve(md);
			} else {
				let doc = new xmldom.DOMParser().parseFromString(body);
				let tableNodes = xpath.select("//table[@class='attributes']", doc);

				for (let i = 0; i < tableNodes.length; i++) {
					let table = tableNodes[i];
					if (table.previousSibling != undefined &&
						table.previousSibling.textContent == "Attribute inheritance") {
						let jsonTables = new HtmlTableToJson(table.toString());
						let header = jsonTables.headers[0];
						let result = jsonTables.results[0];
						if (header[0] == '#' && header[1] == 'Attribute' && header[2] == 'Type') {
							for (let index = 0; index < result.length; index++) {
								let currentRow = result[index];
								if (currentRow['#'].startsWith('Ifc')) {
									md = md + '**' + currentRow['#'] + '**  \n';
								} else if (currentRow['#'] == '') {
									md = md + '*' + currentRow['Attribute'] + '* : `' + currentRow['Type'] + '`  \n';
								} else {
									md = md + currentRow['#'] + '.' + currentRow['Attribute'] + ' : `' + currentRow['Type'] + '`  \n';
								}
							}
							resolve(md);
							return;
						}
					}
				}
			}
		})
	});
}

class StepHoverProvider implements HoverProvider {
	provideHover(
		document: TextDocument, position: Position, token: CancellationToken):
		Thenable<Hover> {
		let refText = getStepReferenceIdFromDocument(document, position);
		var word = '';

		if (refText.length > 0) {
			for (let index = 0; index < document.lineCount; index++) {
				let line = document.lineAt(index);
				let noWhiteIndex = line.firstNonWhitespaceCharacterIndex;
				let afterRefIndex = refText.length + noWhiteIndex;
				if (line.text.length > afterRefIndex) {
					let nextChar = line.text[afterRefIndex];
					if (line.text.startsWith(refText, noWhiteIndex) && (NOT_DIG_REGEXP.test(nextChar))) {
						word = line.text;
						break;
					}
				}
			}
		} else {
			let typeName = getTypeNameFromDocument(document, position);
			if (typeName.length > 0) {
				return getIfcTypeHyperLink(typeName, CURRENT_SCHEMA).then(result => {
					if (CURRENT_SCHEMA == 'IFC4X1') {
						return getIfc4x1EntityAttributeMarkdownString(new URL(result));
					} else {
						return `[goto schema page](${result})`;
					}
				}).then(result => {
					return new Hover(result);
				});
			}
		}

		return new Promise<Hover>((resolve, reject) => {
			resolve(new Hover(word));
		});
	}
}

class StepDefinitionProvider implements DefinitionProvider {
	provideDefinition(
		document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
		let refText = getStepReferenceIdFromDocument(document, position);

		if (refText.length > 0) {
			for (let index = 0; index < document.lineCount; index++) {
				let line = document.lineAt(index);
				let noWhiteIndex = line.firstNonWhitespaceCharacterIndex;
				let afterRefIndex = refText.length + noWhiteIndex;
				if (line.text.length > afterRefIndex) {
					let nextChar = line.text[afterRefIndex];
					if (line.text.startsWith(refText, noWhiteIndex) && (NOT_DIG_REGEXP.test(nextChar))) {
						return new vscode.Location(document.uri, line.range);
					}
				}
			}
		} else {
			let typeName = getTypeNameFromDocument(document, position);
			if (typeName.length > 0) {
				getIfcTypeHyperLink(typeName, CURRENT_SCHEMA).then(result => {
					vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(result));
				});
			}
		}
		return undefined;
	}
}

class SchemaInfoController {
	private _statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	private _disposable: vscode.Disposable;

	constructor() {
		let subscriptions: vscode.Disposable[] = [];
		vscode.window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
		this._disposable = vscode.Disposable.from(...subscriptions);
		this._onEvent();
	}

	private _onEvent() {
		if (vscode.window.activeTextEditor.document.languageId === 'step') {
			this._statusBarItem.text = getSchemaFromDocument(vscode.window.activeTextEditor.document);
			CURRENT_SCHEMA = this._statusBarItem.text;
			this._statusBarItem.show();
		} else {
			this._statusBarItem.hide();
		}
	}

	dispose() {
		this._disposable.dispose();
		this._statusBarItem.dispose();
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('step active.');

	context.subscriptions.push(vscode.languages.registerHoverProvider(STEP_MODE, new StepHoverProvider()));
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(STEP_MODE, new StepDefinitionProvider()));
	context.subscriptions.push(new SchemaInfoController());
}

// this method is called when your extension is deactivated
export function deactivate() { }
