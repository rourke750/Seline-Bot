let methodMapping = {};
let pastExecutions = {};

let errorStacks = {};

/**
 * Threads work by running even if their priority is low.  ie if you set the position to 10 but there is execution power for it to still run
 * then it will run.
 */
class Thread {
    /**
     * position: set to 0 to run every tick, -1 to have to run every tick
     * currentPos has to be 10 or less
    */
    constructor(name, currentPos, resetPos, exitOnFailure) {
        this.name = name;
        this.currentPosition = currentPos;
        this.resetPosition = resetPos;
        this.exitOnFailure = exitOnFailure;
    }

    run() {
        methodMapping[this.name]();
        this.currentPosition = this.resetPosition;
    }

    shouldRun() {
        return true;
    }

    value() {
        return this.currentPosition;
    }

    tick() {
        this.currentPosition -= 1;
        if (this.value() < -10) {
            console.log('I AM BEING IGNORED THREAD ' + this.name)
        }
    }

    shouldExitOnFailure() {
        return this.exitOnFailure;
    }
}

/**
 * Timed threads only run after x amount of time, even if there is execution for them they will wait
 * We use a combination of delay + currentposition.
 * CurrentPosition is the priority of the task after delay is finished
 * 
 * For example if we have a timedthread that has a priority 10 and delay of 30, it will wait 30 seconds before running
 * and then it will try to run.  If the cpu usage is too high it will continue to decrement until it becomes a higher priority and can be run
 */
class TimedThread extends Thread {

    // priority has to be 11 or greater
    constructor(name, priority, delay, resetDelay) {
        super(name, priority, priority);
        this.delay = delay;
        this.resetDelay = resetDelay;
        if (this.resetDelay == null) {
            throw 'error resetdelay null ' + name; 
        }
        if (priority < 10) {
            throw 'For ' + name + ' timed threads cannot have a priority less than 10 or it conflicts with other normal threads'
        }
    }

    run() {
        super.run()
        this.delay = this.resetDelay;
    }

    shouldRun() {
        return this.delay <= 0;
    }

    value() {
        return this.currentPosition + this.delay;
    }

    tick() {
        this.delay -= 1; // this can become negative and will lower the value which is intentional
        if (this.value() < -10) {
            console.log('I AM BEING IGNORED TIMED ' + this.name);
        }
    }
}

class Heap {
    constructor(comparator = (a, b) => a - b) {
        this.array = [];
        this.comparator = (i1, i2) => comparator(this.array[i1].value(), this.array[i2].value());
    }
  
    /**
     * Insert element
     * @runtime O(log n)
     * @param {any} value
     */
    add(t) {
        this.array.push(t);
        this.bubbleUp();
    }
  
    /**
     * Move new element upwards on the Heap, if it's out of order
     * @runtime O(log n)
     */
    bubbleUp() {
        let index = this.size() - 1;
        const parent = (i) => Math.ceil(i / 2 - 1);
        while (parent(index) >= 0 && this.comparator(parent(index), index) > 0) {
            this.swap(parent(index), index);
            index = parent(index);
        }
    }

    get(index) {
        return this.array[index];
    }

    size() {
        return this.array.length;
    }

    print() {
        console.log(JSON.stringify(this.array.map(v => v.value())));
    }

    remove(index = 0) {
        if (!this.size()) return null;
        this.swap(index, this.size() - 1); // swap with last
        const value = this.array.pop(); // remove element
        this.bubbleDown(index);
        return value;
    }

    /**
     * After removal, moves element downwards on the Heap, if it's out of order
     * @runtime O(log n)
     */
    bubbleDown(index = 0) {
        let curr = index;
        const left = (i) => 2 * i + 1;
        const right = (i) => 2 * i + 2;
        const getTopChild = (i) => (right(i) < this.size()
            && this.comparator(left(i), right(i)) > 0 ? right(i) : left(i));
        
        while (left(curr) < this.size() && this.comparator(curr, getTopChild(curr)) > 0) {
            const next = getTopChild(curr);
            this.swap(curr, next);
            curr = next;
        }
    }

    swap(i, j) {
        const temp = this.array[i];
        this.array[i] = this.array[j];
        this.array[j] = temp;
    }
}

if (Memory.os == null) {
    Memory.os = {};
}

const heap = new Heap();

var Threads = {
    newThread: function(name, method, position, exitOnFailure=false) {
        if (name in methodMapping) {
            throw 'name already added';
        }
        methodMapping[name] = method;
        let t = null;
        if (Memory.os[name] == null) {
            t = new Thread(name, position, position);
        } else {
            t = new Thread(name, Memory.os[name].position, position);
        }
        heap.add(t);
    },

    newTimedThread: function(name, method, priority, startDelay, resetDelay) {
        if (name in methodMapping) {
            throw 'name already added';
        }
        methodMapping[name] = method;
        let t = null;
        if (Memory.os[name] == null) {
            t = new TimedThread(name, priority, startDelay, resetDelay);
        } else {
            t = new TimedThread(name, priority, Memory.os[name].position, resetDelay);
        }
        heap.add(t);
    },

    existsThread: function(name) {
        return name in methodMapping;
    },

    getStats: function() {
        return pastExecutions;
    },

    run: function() {
        pastExecutions = {};
        // first run through just tick everyone
        let start = Game.cpu.getUsed();
        let loops = 0;
        for (let i = 0; i < heap.size(); i++) {
            const v = heap.get(i);
            v.tick();
        }

        const readd = [];
        // now logic for running through
        for (let i = 0; i < heap.size(); i++) {
            loops++;
            const v = heap.remove();
            readd.push(v)
            if (!v.shouldRun())
                break;

            try {
                const s = Game.cpu.getUsed();
                v.run();
                pastExecutions[v.name] = Game.cpu.getUsed() - s;
            } catch (error) {
                console.log(error + '\n' + error.stack)
                if (!(error.stack in errorStacks)) {
                    Game.notify(error.stack);
                    errorStacks[error.stack] = true;
                }
            }

            //console.log(v.name + ' ' +v.value() + ' ' + i);
            // going to check usage and if its greater than 30 break for now
            if (Game.cpu.getUsed() >= Game.cpu.limit - (Game.cpu.limit / 10)) {
                //console.log('os cpu usage exceeding skipping')
                break;
            }
        }
        for (const i in readd) {
            const v = readd[i];
            heap.add(v);
        }
        
        let end = Game.cpu.getUsed();
        
        //console.log('cpu start '  + start + ' end ' + end + ' loops ' + loops)
        //heap.print()
        //console.log(heap.size())
        //console.log(heap.size())
        //console.log(end - start + ' ' + Game.cpu.limit)
    },
    
    getHeap: function() {
        return heap;
    }
};

module.exports = Threads;