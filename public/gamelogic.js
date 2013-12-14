//global objects
// TODO: see if connect('/') works
var socket = io.connect('http://localhost');
var MasterWord = new WordsAndClues(true, false, false);
var secretWord = new WordsAndClues(false, true, false);
var clue = new WordsAndClues(true, true, true);
var activePlayers = {length:0};

// defines visibility of words and clues
function WordsAndClues (visibleToWordMaster, visibleToClueGiver, visibleToPlayer) {
	this.visibleToWordMaster = visibleToWordMaster;
	this.visibleToClueGiver = visibleToClueGiver;
	this.visibleToPlayer = visibleToPlayer;
}

// creates, renders, and adds player to active players array.
function renderPlayer (player) {
	$('tbody').append(
		'<tr>' +
			'<td>' + player.name + '</td>' +
			'<td>' + 'response placeholder' + '</td>' +
		'</tr>' );
}

function removePlayer (name) {
	delete activePlayers[name];
	activePlayers.length--;

	$('tr:contains(' + name + ')')
		.remove() // remove player name
		.next()
		.remove() // remove player status
		.next()
		.remove() // remove player response
}

// TODO: find a more semantic convention for type overloading
function Player (name, guess) {
	if (typeof name === "object")
		for (prop in name) this[prop] = name[prop];
	else {
		this.name = name || "";
		this.guess = guess || ""; }
	activePlayers[this.name] = this;
	activePlayers.length++;
}

// sets new wordMaster. if applicable, reset previous wordMaster to regular player.
function setMaster (player) {
	if (window.wordMaster) delete wordMaster.secret;
	return wordMaster = player;
}

// sets new clueGiver. if applicable, reset previous clueGiver to regular player.
function setGiver (player) {
	if (window.clueGiver) {
		delete clueGiver.secret;
		delete clueGiver.clue; }
	return clueGiver = player;
}

function preventDuplicateNames(playerName) {
	if(!activePlayers.length) {
		return true;
	}
	for (name in activePlayers) {
		if(playerName === name) {
			$('#input')
				.css('background', '#FF8566')
				.val('')
				.prop('placeholder', 'Name already taken, please choose another');
			console.log("same name!");
			return false;
		}
	}
	return true;
}

function modal() {
	$('body').append("<div class='modal'><div class='modal-inner'><p>Hello world</p></div></div>");
}

///////////////////   Stages    ///////////////////////////

// executes another round of the game
var playRound = series(
	chooseMasterWord,
	chooseGiverWord,
	guessWord
	// TODO: add the rest of the stages
);

// runs function as a waterfall
// TODO: maybe replace this with promises
function series () { 
    var context = this;
    return [].reduceRight.call(arguments, function(next,current) {
		return current.bind(context, next);
	});
}

// creates, renders, and emits the local player upon name decision
function chooseName () {
	console.log('choosing name');

	getInput('Choose a Nickname', preventDuplicateNames)
	.then(function(name) {
		renderPlayer(localPlayer = new Player(name));
		socket.emit('joined', localPlayer);
		$("td:empty").parent().remove();
	}, function() {
		console.log("failed, calling function again")
		chooseName();
	})
}

function chooseMasterWord (callback) {
	console.log('choosing master word');

	getInput('Type in your secret word')
		.then(function(secret) {
			if (localPlayer === wordMaster) {
			// for wordmaster, enable input and replace placeholder text with status
				$('#input')
					.attr('disabled', false)
					.attr('placeholder','Type in your secret word');
				// on submit- disabling wordMaster's input
				$('#gameForm').submit(function(e) {
					e.preventDefault();
						$("#input")
							.attr('disabled', true)
							.attr('placeholder','Your secret word is' + secret);
				});
			} else {
			// for everyone else, keep input disabled and replace placeholder text with status
				$('#input').attr('placeholder','Waiting for MasterWord');
			}

		//splitting masterword into an array of strings
		var splitWord = MasterWord.split('');

		//append first letter of masterword to master-word-box
		$('.master-word-box').append(splitWord[0]);
	})
	.then(callback);
}

function chooseGiverWord (callback) {
	console.log('choosing giver word');

	if (localPlayer === clueGiver) {
		$('#input').attr('disabled', false);

		//switch input conext to secretword
		getInput('Type in a secret word')
			.then(function(secretWord) {})
			.then(callback);

		//switch input context from secret word to secret clue
		getInput("Now type a clue.")
			.then(function(clue){})
			.then(callback);
	}
	// appending string into clue box- visible to everyone.
	$('.clue-box').append(clue);
	//TODO: allow cluegiver to edit secret clue as many times as he/she wants
}

function guessWord (callback) {
	console.log('guessing word');

	if (localPlayer !== clueGiver && localPlayer !== wordMaster) {
		//players are now able to type guesses
		$('#input').attr('disabled', false);
		getInput('What is ' + clueGiver + " 's word?")
			.then(function(guess){
				socket.emit('guessed', guess);
			})
			.then(callback);
	}
}

	//TODO: implement wordMaster guesses. can guess as many times as he/she wants.
	//TODO: each player can input a guess once.
	//TODO: set up success condition to reveal next letter of masterword if strings from player guesses match.


/////////////////////////////////////////////////////////

// greys out the input box with a placeholder msg
function greyInput (placeholder) {
	$("#input")
		.val('')
		.prop('disabled', true)
		.prop('placeholder', placeholder);
}

// returns a promise that binds function contexts to #input
function getInput (placeholder, validate) {
	var deferred = new $.Deferred();
	var input = $("#input").attr('placeholder', placeholder);

	// clear out old handlers
	$('#gameForm').off('submit');
	$('#gameForm').submit(function(e) {
	 	e.preventDefault();
	 	validate(input.val())
	 		? deferred.resolveWith(input, [input.val()])
	 		: deferred.rejectWith(input, [input.val()]);
 	}); 

	return deferred.promise()
}

window.onload = function() {
	// TODO: make sure all emitions are being captured
	// 		 even though we don't listen until now
	socket.on('joined', function(playerData){
		renderPlayer(new Player(playerData));
	});

	socket.on('left', function(name){
		console.log(name + ' left');
		removePlayer(name);
	});

	socket.on('pause', function(reason){
		console.log('paused');
		// TODO: popup modal
	});

	socket.on('resume', function(){
		console.log('resumed');
		// TODO: remove modal
	});

	// Game Loop (runs if name has been chosen)
	socket.on('newRound', function(pair){
		setMaster(activePlayers[pair.master]);
		setGiver(activePlayers[pair.giver]);
		if (localPlayer) playRound();
	});

	chooseName();




//Remaining TODOs------------------

// Set the input placeholder of players to 'waiting for wordmaster'. DONE

// Enable input for word master. DONE

// word master's input is labeled with "Choose master word". DONE

// when user enters in master word it is populated into the master. In PROGRESS.

// word box, but this is hidden from everyone except the word master.

// Disable input for wordmaster

// Enable input for word/clue chooser

// Select first person in the user column, prompt him or her to enter
// a word -- the input field has a label choose secret word. The chosen
// user's status is populated with the secret word they chose. IN PROGRESS

// Then the chosen player types in a clue. The input has a label called:
// choose clue for secret word. On submit the clue box is populated with
// clue.

// Disable input for word/clue chooser

// Enable input for other players and wordmaster

// The other players who did not choose a master secret word start
// guessing words by typing. Their input is labeled with: "Start
// guessing what the word is", and on submit their response is stored
// and their input is locked up. Status becomes clue submitted, and
// response field in table is populated with their guess, which is currently
// hidden from everyone except them.

// Once a player has guessed, disable input

// The word master's guess, however, is visible to everyone playing.

// The input field of the player who chose the word/clue is locked for
// this round.

// Compare user inputs with secret word. If the players have the same guesses and
// their guess is the same as the secret word AND they do all this before the word
// master, reveal the first obscured character of the master secret word.
// else, failure and the character remains obscured.

// If player secret word is equal to master secret word, and the master secret
// word is correctly chosen by the players, the players win and the word
// master loses.

// The player who chose the secret word wins the game and becomes the next
// word master.

// If the master secret word is not guessed at the end of the round,
// select next player in user column and begin again.


};