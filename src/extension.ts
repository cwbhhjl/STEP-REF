// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { debuglog, debug } from 'util';
import { HoverProvider, TextDocument, Position, CancellationToken, Hover } from 'vscode';

const STEP_MODE: vscode.DocumentFilter = { language: 'step', scheme: 'file' };

function getStepReferenceId(document: TextDocument, position: Position) : string {
	let wordAtPosition = document.getWordRangeAtPosition(position, /#[0-9]+/);
	let referenceIdText = '';
	if (wordAtPosition) {
		referenceIdText = document.getText(wordAtPosition);
		if (referenceIdText.length > 1 && referenceIdText.startsWith('#')) {
			return referenceIdText;
		}
	}
	return '';
}

class StepHoverProvider implements HoverProvider {
    public provideHover(
        document: TextDocument, position: Position, token: CancellationToken):
        Thenable<Hover> {
			let refText = getStepReferenceId(document, position);
			var word = '';

			if (refText.length > 0) {
				for (let index = 0; index < document.lineCount; index++) {
					let line = document.lineAt(index);
					let noWhiteIndex = line.firstNonWhitespaceCharacterIndex;
					if (line.text.startsWith(refText, noWhiteIndex)) {
						word = line.text;
					}
				}
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
	debuglog('step active.');

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
export function deactivate() {}
