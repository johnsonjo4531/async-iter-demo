import {createReadStream} from 'fs';

/**
 * Takes an element to listen on and listens for all events
 * only allowing the first triggered event to resolve the 
 * promise and then cancels all listeners.
 * 
 * @returns a promise
 */
function onceForAll(el, ...events) {
  return new Promise((resolve, reject) => {
    let handlers = {};
    const handler = (eventName) => function(e) { 
      resolve([eventName, e]);
      for(let event of events) {
        el.removeListener(event, handlers[event]);
      }
    };
    for(let event of events) {
      if(handlers[event]) {
          continue;
      }
      handlers[event] = handler(event);
      el.on(event, handlers[event]);
    }
  });
}

/**
 * Creates an asynchronous ReadStream for the file whose name
 * is `fileName` and feeds it into an AsyncQueue that it returns.
 * 
 * @returns an async iterable 
 * @see ReadStream https://nodejs.org/api/fs.html#fs_class_fs_readstream
 */
async function* readFile(fileName) {
    const readStream = createReadStream(fileName,
        { encoding: 'utf8', bufferSize: 1024 });
    let done = false;
    while(!done) {
        yield await onceForAll(readStream, 'data', 'error', 'end')
            .then(([event, data]) => {
                switch(event) {
                    case 'data':
                        return data.toString('utf8');
                    case 'error':
                        done = true
                        return Promise.reject(data);
                    case 'end':
                        done = true
                        return "";
                }
            });
    }
}

/**
 * Turns a sequence of text chunks into a sequence of lines
 * (where lines are separated by newlines)
 * 
 * @returns an async iterable 
 */
async function* splitLines(chunksAsync) {
    let previous = '';
    for await (const chunk of chunksAsync) {
        previous += chunk;
        let eolIndex;
        while ((eolIndex = previous.indexOf('\n')) >= 0) {
            const line = previous.slice(0, eolIndex);
            yield line;
            previous = previous.slice(eolIndex+1);
        }
    }
    if (previous.length > 0) {
        yield previous;
    }
}

/**
 * @returns an async iterable 
 */
async function* numberLines(lines) {
    let n = 1;
    try {
        for await (const line of lines) {
            yield `${n} ${line}`;
            n++;
        }
    } catch (err) {
        console.error(err);
    }
}

/**
 * @returns a Promise 
 */
async function logLines(asyncIterable) {
    for await (const line of asyncIterable) {
        console.log(line);
    }
}

async function main() {
    const fileName = process.argv[2];
    const asyncIterable = numberLines(splitLines(readFile(fileName)));
    await logLines(asyncIterable);
}
main();