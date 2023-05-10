import { WorkerManager } from '../../../../packages/utils'

describe('Worker Manager Functionality', () => {
  it('should create a worker instance', () => {
    // Create a new worker and check if it is an object
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const worker = manager.create(() => {
        self.onmessage = (event) => {
          const result = event.data * 2;
          self.postMessage(result);
        };
      });
      expect(worker).to.be.a('object');
    });
  });
  
  it('should run all workers in batches of four and retrieve results', () => {
    // Create four workers and run them with a given input data
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const workers = Array.from(new Array(4), () => manager.create((data) => {
        self.onmessage = (event) => {
          const result = event.data * 2;
          self.postMessage(result);
        };
      }));
      const inputData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const expectedOutput = inputData.map(num => num * 2);
      const resultsPromise = manager.runAll(inputData);
      
      // Wait for all workers to finish their execution
      resultsPromise.then((results) => {
        expect(results).to.eqls(expectedOutput);
      });
    });
  });
  
  it('should terminate all workers', () => {
    // Create four workers and terminate them
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const workers = Array.from(new Array(4), () => manager.create((data) => {
        self.onmessage = (event) => {
          const result = event.data * 2;
          self.postMessage(result);
        };
      }));
      manager.terminateAll();
      expect(manager.list()).to.be.empty;
    });
  });
  
  it('should pause and resume workers upon request', () => {
    // Create a worker and pause it's execution, then resume it
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const worker = manager.create((data) => {
        let index = 0;
        let paused = false;
        let intervalId;
        
        // Launch an iteration loop that counts up to 10
        const iterate = () => {
          index++;
          self.postMessage(index);
          
          if (index === 10) {
            clearInterval(intervalId); // Stop the loop
            self.postMessage('finished');
          }
        };
        
        intervalId = setInterval(() => {
          if (!paused) iterate();
        }, 1000);
        
        // Pause and resume function handlers
        self.onmessage = (event) => {
          if (event.data === 'pause') {
            paused = true;
          } else if (event.data === 'resume') {
            paused = false;
          }
        };
      });
      
      // Run the worker for 5 seconds, then pause it
      worker.run().then(() => {
        cy.wait(5000);
        worker.postMessage('pause');
        expect(worker.getState().status).to.be.equal('paused');
        
        // Wait for 2 seconds, then resume the worker
        cy.wait(2000).then(() => {
          worker.postMessage('resume');
          expect(worker.getState().status).to.be.equal('running');
        });
      });
    });
  });
  it('should handle errors inside workers', () => {
    // Create a worker instance that throws an error
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const worker = manager.create(() => {
        throw new Error('Something went wrong')
      });
      
      // Expect an error to be caught and the Promise returned by runAll to be rejected
      const promise = manager.runAll([1, 2, 3, 4]);
      return expect(promise).to.be.rejectedWith('Something went wrong');
    });
  });
  it('should allow subscribing and unsubscribing from worker events', () => {
    // Create a worker instance with a message handler that dispatches an event
    cy.window().then((win) => {
      const manager = new WorkerManager();
      const worker = manager.create(() => {
        self.onmessage = (event) => {
          const data = event.data * 2;
          self.postMessage(data);
        };
      });
      
      // Subscribe a listener function to the worker's 'message' event and test it
      const expectedOutput = [2, 4, 6, 8, 10];
      const eventPromise = new Promise(resolve => {
        worker.subscribe('message', (event) => {
          resolve(event.data);
        });
      });
      const resultsPromise = manager.runAll([1, 2, 3, 4, 5]);
      
      // Expect to receive five events, one for each task, with the expected output
      resultsPromise.then(() => eventPromise.then((values) => {
        expect(values).to.have.lengthOf(5);
        expect(values).to.eqls(expectedOutput);
      })).then(() => {
        // Unsubscribe the listener function and test it again
        worker.unsubscribe('message');
        const anotherPromise = new Promise(resolve => {
          worker.subscribe('message', (event) => {
            resolve(event.data);
          });
        });
        
        // Expect to receive five new events with a different expected output
        const anotherResultsPromise = manager.runAll([2, 4, 6, 8, 10]);
        return anotherResultsPromise.then(() => anotherPromise.then((values) => {
          expect(values).to.have.lengthOf(5);
          expect(values).to.eqls([4, 8, 12, 16, 20]);
        }));
      });
    });
  });
  it('should prevent multiple instances of the worker manager', () => {
    // Create two instances of the worker manager and expect an error to be thrown
    cy.window().then((win) => {
      expect(() => new WorkerManager()).to.not.throw();
      expect(() => new WorkerManager()).to.throw('Only one instance of WorkerManager is allowed');
    });
  });
});