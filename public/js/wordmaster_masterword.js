var masterWordIndex = -1; //later incremented to 0 before render

function setMaster (player) {
	if (window.wordMaster) delete wordMaster.word;
	return wordMaster = player;
	//replacing with D3 code
	//localPlayer.el.find('.response').text(guess);
}

function chooseMasterWord () {
	console.log("choosing master word");

	if (localPlayer === wordMaster) {
		getInput('You are the Word Master. Type in your word!')
		.then(function(word) {
			greyInput('The Master Word is ' + word);
			socket.emit('masterWordChosen', word);
			wordMaster.word = word;
			revealLetter();
		});
	} else {
		greyInput('Waiting for master word');
	}
}

// creates, renders, and emits the local player upon name decision
function revealLetter () {
	$('.master-word-box').append(
		wordMaster.word[++masterWordIndex] );
}

