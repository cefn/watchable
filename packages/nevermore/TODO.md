Generalise the format of

const winner = await namedRace({ launch:launchPromise, cancel:cancelPromise, });
if(winner === "cancel"){ // do something }

Introduce and test instances of Strategy in order (lifting in the argument
definitions from previous nevermore implementation)
