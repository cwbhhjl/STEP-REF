// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HoverProvider, TextDocument, Position, CancellationToken, Hover } from 'vscode';

const STEP_MODE: vscode.DocumentFilter = { language: 'step', scheme: 'file' };

const IFC_SCHEMA_URL = {
	'IFC2X3': [
		'http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_selecttype.htm',
		'http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_enumtype.htm',
		'http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_definedtype.htm',
		'http://www.buildingsmart-tech.org/ifc/IFC2x3/TC1/html/alphabeticalorder_entities.htm'
	],
	'IFC4': ['http://www.buildingsmart-tech.org/ifc/IFC4/final/html/toc.htm'],
	'IFC4X1': ['http://www.buildingsmart-tech.org/ifc/IFC4x1/final/html/toc.htm']
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

function getSchemaFromDocument(document: TextDocument, position: Position): string {
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

class StepHoverProvider implements HoverProvider {
	public provideHover(
		document: TextDocument, position: Position, token: CancellationToken):
		Thenable<Hover> {
		let refText = getStepReferenceIdFromDocument(document, position);
		var word = '';

		if (refText.length > 0) {
			for (let index = 0; index < document.lineCount; index++) {
				let line = document.lineAt(index);
				let noWhiteIndex = line.firstNonWhitespaceCharacterIndex;
				if (line.text.startsWith(refText, noWhiteIndex)) {
					word = line.text;
				}
			}
		} else {
			// let typeName = getTypeNameFromDocument(document, position);
			// if (typeName.length > 0) {
			// 	word = typeName;
			// }
		}

		return new Promise<Hover>((resolve, reject) => {
			resolve(new Hover(word));
		});
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('step active.');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(vscode.languages.registerHoverProvider(STEP_MODE, new StepHoverProvider()));
}

// this method is called when your extension is deactivated
export function deactivate() { }
