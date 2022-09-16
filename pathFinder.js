const os = require('os');
var _ = require('lodash');

const swampCostConst = 10;
const plainCost = 2;

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}

let destinationMappings = {}; // room to position to creeps
let currentCreepMapping = {}; // room to current position to creeps

const pathGenerator = {

    solvePaths: function() {

    },

    registerCreepDst: function(creep, nextX, nextY) {
        const roomName = creep.pos.roomName;
        const dstKey = `${nextX}-${nextY}`;
        if (!(roomName in destinationMappings)) // no room name
            destinationMappings[roomName] = {};
        if (!(dstKey in destinationMappings[roomName])) // no dstkey
            destinationMappings[roomName][dstKey] = [];

        const curKey = `${creep.pos.x}-${creep.pos.y}`;
        if (!(roomName in currentCreepMapping)) // no room name
            currentCreepMapping[roomName] = {};
        if (!(curKey in currentCreepMapping[roomName])) // no dstkey
            currentCreepMapping[roomName][curKey] = [];

        destinationMappings[roomName][dstKey].push(creep);
        currentCreepMapping[roomName][curKey].push(creep);
    },

    resetCreepDst: function() {
        destinationMappings = {};
        currentCreepMapping = {};
    },

    find_path_in_room: function(creep, dstX, dstY, opts={maxOps:2000, avoidCreep: false}) {
        if (opts == null) {
            opts = {};
        }
        opts.maxOps = opts.maxOps || 2000;
        opts.avoidCreep = opts.avoidCreep || false;
        opts.swampCost = opts.swampCost || swampCostConst;
        //opts.sCostMatrix = opts.sCostMatrix || null;

        if (creep.pos.x == dstX && creep.pos.y == dstY) {
            return Room.serializePath([]);
        }

        // get the cost matrix for the room
        // check if in cache
        let range = 0
        if (creep.room) {
            const struct = creep.room.lookAt(dstX, dstY);
            if (struct.length > 0) {
                for (s in struct) {
                    if ((struct[s].type == 'structure' && struct[s].structure.structureType in obsticalD) || 
                    struct[s].type in obsticalD || (struct[s].type == 'constructionSite' && struct[s].constructionSite.structureType in obsticalD)) {
                        range = 1;
                        break;
                    }
                }
            }
            // check if there is a wall if so set range to large
            if (range == 0 && creep.room.getTerrain().get(dstX, dstY) == TERRAIN_MASK_WALL)
                range = 10;
        }
        
        const v = PathFinder.search(creep.pos, {'pos': new RoomPosition(dstX, dstY, creep.pos.roomName), 'range': range},
            {
                plainCost: plainCost,
                swampCost: opts.swampCost,
                roomCallback: function(roomName) {
                    if (roomName != creep.pos.roomName) { // we only want paths in this room
                        return false;
                    }
                    let c = null
                    if (roomName in Memory.costMatrix)
                        c = PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    else if (pathGenerator.build_cost_matrix(roomName)) {
                        c = PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    }
                    
                    if (opts.avoidCreep && c != null) {
                        const r = Game.rooms[roomName];
                        if (r == null) {
                            return c;
                        }
                        r.find(FIND_CREEPS).forEach(function(oC) {
                              c.set(oC.pos.x, oC.pos.y, 0xff);
                            });
                    }

                    //if (c != null && opts.sCostMatrix != null) {
                    //    c = new DualCostMatrix(c, opts.sCostMatrix);
                    //}

                    return c;
                },
                maxOps: opts.maxOps
            }
        )

        if (v.incomplete) {
            return Room.serializePath([]);
            //console.log('incomplete dst to ' + dstX + ' ' + dstY + ' from ' + creep.pos + ' range ' + range + ' ops ' + v.ops + ' avoid creeps ' + opts.avoidCreep +' paths ' + v.path)
        }
        if (v.path.length == 0) {
            //console.log('Zero path ' + creep.name + ' ' + creep.pos + ' to ' + dstX + ' ' + dstY + ' cost ' +v.cost + ' range ' + range)
            return Room.serializePath([]);
        }
        const convertedPath = this.convertPathFinderSearch(creep.pos, v.path)
        if (!(creep.pos.roomName in convertedPath)) {
            return Room.serializePath([]);
        }
        const p = Room.serializePath(convertedPath[creep.pos.roomName]);
        return p;
    },

    findHighwayGetPath: function(pos, dstRoom) {
        const oRoom = Game.map.describeExits(pos.roomName)[this.getExitBasedOnPos(pos)];
        return PathFinder.search(pos, {'pos': new RoomPosition(23, 23, dstRoom), range: 20},
            {
                plainCost: plainCost,
                swampCost: swampCostConst,
                maxOps: 4000,
                roomCallback: function(roomName) {
                    // check if roomname equals a room we maybe just came from and that its not the room we are going to
                    if (roomName != dstRoom && roomName != pos.roomName) {
                        return false;
                    }
                    if (roomName in Memory.costMatrix)
                        return PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    else if (pathGenerator.build_cost_matrix(roomName)) {
                        return PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    }
                    return null;
                }
            }
        )
    },

    getStartAndExit: function(pos, dstRoom, v) {
        // calculate start of highway
        var startPos = 0;
        for (const path in v.path) {
            if (path == 0) {
                continue;
            }
            const p = v.path[path];
            if (p.roomName != pos.roomName) {
                startPos = path - 1;
                break;
            }
        }
        
        // calculate endPath ie first tile into a room
        var endPos = v.path.length - 1
        for (; endPos > startPos; endPos--) {
            if (v.path[endPos-1].roomName != dstRoom) {
                break;
            }
        }
        return [startPos, endPos];
    },
    
    find_highway: function(pos, dstRoom, opts={}) {
        opts.avoidHostile = opts.avoidHostile || false;

        // We want to see if a path to the dstRoom already exists if not we need to create it
        // We are just going to set it to the middle of the room
        // todo in the future come up with a better way to do this
        if (Memory.highway == null) {
            Memory.highway = {}; // will be starting_room: {dst_room: [starting room pos, Pathfinder path]}
        }
        
        if (Memory.costMatrix == null) {
            Memory.costMatrix = {};
        }

        paths = {};
        const route = Game.map.findRoute(pos.roomName, dstRoom, {
            routeCallback(roomToName, roomFromName) {
                if (opts.avoidHostile && roomToName in Memory.rooms && Memory.rooms[roomToName].eCP) {
                    return Infinity;
                } else if (roomToName in Memory.flags.blacklist) {
                    return Infinity;
                }
                return 1;
            }
        });
        let currentRoom = pos.roomName;
        let start;
        for (const k in route) {
            let nextStart;
            const dir = route[k];
            if (k == 0) {
                start = pos;
            }

            if (!(currentRoom in Memory.highway)) {
                Memory.highway[currentRoom] = {};
            }

            // let's check if the current room has an exit
            let exits = Memory.highway[currentRoom].exits;
            if (!exits) { // initialize if its missing
                Memory.highway[currentRoom].exits = {};
                exits = Memory.highway[currentRoom].exits;
            }

            let tempPath;
            if (!(dir.exit in exits)) {
                // no exit generate it
                const v = this.findHighwayGetPath(start, dir.room);
                if (v.incomplete) {
                    console.log('pathFinder incomplete path when trying to find highway room: ',dir.room, JSON.stringify(v));
                    return; // exit dont want the shit path
                }
                const r = this.getStartAndExit(start, dir.room, v);
                let s = r[0]; // last position before next room
                let e = r[1]; // first position in new room
                if (s == e) { // we are standing on the border
                    v.path.unshift(start)
                    e = 1;
                    console.log('herm is this the problem in pathfinder s:', s, ' e: ', e, start, dir.room, JSON.stringify(v))
                }

                exits[dir.exit] = {x: v.path[s].x, y: v.path[s].y};
                //console.log(s, e, JSON.stringify(v.path))

                // add exit to other room
                if (!(dir.room in Memory.highway)) {
                    Memory.highway[dir.room] = {};
                }
                if (!Memory.highway[dir.room].exits) {
                    Memory.highway[dir.room].exits = {};
                }
                Memory.highway[dir.room].exits[this.getOppositeExit(dir.exit)] = {x: v.path[e].x, y: v.path[e].y};
                tempPath = this.convertPathFinderSearch(start, v.path.slice(0, e));
                // set start for next loop
                nextStart = v.path[e];
            } else {
                // if the direction existed in exits it means the adjacent room has an exit to we can use for start
                const t = Memory.highway[dir.room].exits[this.getOppositeExit(dir.exit)];
                nextStart = new RoomPosition(t.x, t.y, dir.room);
            }

            // check if we are first or last room if we aren't lets get a pregenerated path
            const entrance = this.getExitBasedOnPos(start);
            if (k > 0) {
                // check if a path exists
                // need to build out the struct if it doesnt exist
                if (!Memory.highway[start.roomName].paths) {
                    Memory.highway[start.roomName].paths = {};
                }
                if (!(entrance in Memory.highway[start.roomName].paths)) {
                    Memory.highway[start.roomName].paths[entrance] = {};
                }

                // now check if entrance to exit exists, if it doesn't go ahead and save to memory
                if (!(dir.exit in Memory.highway[start.roomName].paths[entrance])) {
                    const t = Memory.highway[start.roomName].exits[dir.exit];
                    const dst = new RoomPosition(t.x, t.y, start.roomName);
                    if (!tempPath) {
                        tempPath = {};
                        tempPath[start.roomName] = Room.deserializePath(this.find_path_in_room({pos:start}, dst.x, dst.y));
                    }
                    // save path to memory
                    Memory.highway[start.roomName].paths[entrance][dir.exit] = Room.serializePath(tempPath[start.roomName]);
                }
            }

            // set the paths for each static highway path
            if (k > 0) {
                paths[start.roomName] = Memory.highway[start.roomName].paths[entrance][dir.exit];
            }
            currentRoom = dir.room;
            start = nextStart;
        }
        if (route == -2) {
            console.log('Error getting path from ' + pos.roomName + ' to ' + dstRoom);
            return;
        }
        return [paths, Memory.highway[pos.roomName].exits[route[0].exit]];
    },
    
    getDirection: function(dx, dy) {
        let adx = Math.abs(dx), ady = Math.abs(dy);
 
        if(adx > ady * 2) {
            if(dx > 0)
                return RIGHT;
            else
                return LEFT;
        } else if(ady > adx * 2) {
            if(dy > 0)
                return BOTTOM;
            else
                return TOP;
        } else {
            if(dx > 0 && dy > 0)
                return BOTTOM_RIGHT;
            if(dx > 0 && dy < 0)
                return TOP_RIGHT;
            if(dx < 0 && dy > 0)
                return BOTTOM_LEFT;
            if(dx < 0 && dy < 0)
                return TOP_LEFT;
        }
    },
    
    convertPathFinderSearch: function(fromPos, path) {
        var curX = fromPos.x;
        var curY = fromPos.y;
        const resultPath = {};
        for(let i = 0; i < path.length; ++i) {
            const dirPos = path[i];
            let pos = path[i];
            if (!(pos.roomName in resultPath)) {
                resultPath[pos.roomName] = [];
            }
            const result = {
                x: pos.x,
                y: pos.y,
                dx: dirPos.x - curX,
                dy: dirPos.y - curY,
                direction: this.getDirection(dirPos.x - curX, dirPos.y - curY)
            };
     
            curX = result.x;
            curY = result.y;
            resultPath[pos.roomName].push(result);
        }
        return resultPath;
    },
    
    build_cost_matrix: function(roomName, override=false) {
        // We want to build a cost matrix per room and then save to memory
        
        if (Memory.costMatrix == null) {
            Memory.costMatrix = {};
        }
        
        if (roomName in Memory.costMatrix && !override)
            return true
        
        let room = Game.rooms[roomName];
        
        if (!room) return false;
        let costs = new PathFinder.CostMatrix;

        room.find(FIND_STRUCTURES).forEach(function(struct) {
          if (struct.structureType === STRUCTURE_ROAD) {
            // Favor roads over plain tiles
            costs.set(struct.pos.x, struct.pos.y, 1);
          } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                     (struct.structureType !== STRUCTURE_RAMPART ||
                      !struct.my)) {
            // Can't walk through non-walkable buildings
            costs.set(struct.pos.x, struct.pos.y, 0xff);
          }
        });

        room.find(FIND_CONSTRUCTION_SITES).forEach(function(struct) {
            if (struct.structureType in obsticalD) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            } else if (struct.structureType == STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            }
        });
        
        // after resetting cost matrix go through memory and set path if road
        if (Memory.construction && Memory.construction.paths) {
            for (const kPath in Memory.construction.paths) {
                for (const k in Memory.construction.paths[kPath]) {
                    const p = Memory.construction.paths[kPath][k];
                    if (p[2] == STRUCTURE_ROAD) {
                        costs.set(p[0], p[1], 1);
                    }
                }
            }
        }

        Memory.costMatrix[roomName] = costs.serialize();
        return true;
    },

    getOppositeExit(exit) {
        switch (exit) {
            case 1: return 5;
            case 3: return 7;
            case 5: return 1;
            case 7: return 3;
        }
    },

    getExitBasedOnPos: function(pos) {
        if (pos.y == 0)
            return 1;
        else if (pos.x == 49)
            return 3;
        else if (pos.y == 49)
            return 5;
        else if (pos.x == 0)
            return 7;
        return null;
    },

    test1: function() {
        let start = Game.cpu.getUsed()
        const v = PathFinder.search({x: 33, y: 18, roomName: 'W3N7'}, new RoomPosition(23, 23, 'W2N5'),
            {
                plainCost: plainCost,
                swampCost: swampCostConst,
                roomCallback: function(roomName) {
                    if (roomName in Memory.costMatrix)
                        return PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    else if (pathGenerator.build_cost_matrix(roomName)) {
                        return PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    }
                    return null;
                }
            }
        )
        console.log(Game.cpu.getUsed() - start);
        start = Game.cpu.getUsed()
        Game.map.findRoute('W3N7', 'W2N5')
        console.log(Game.cpu.getUsed() - start);
        return JSON.stringify(v);
    },

    test: function() {
        const s = Game.cpu.getUsed();
        const d = {}
        d['test'] = {a: 'aaaaa', b: "fsdnfjsdf"};
        d['test2'] = {a: 'aaaaa', b: "fsdnfjsdf"};
        d['test3'] = {a: 'aaaaa', b: "fsdnfjsdf"};

        //delete d['test2']
        
        return Game.cpu.getUsed() - s;
    },

    testHighWay: function() {
        const rooms = Memory.highway;
        for (const roomName in rooms) {
            const exits = rooms[roomName].exits;
            for (const e in exits) {
                const pos = exits[e];
                if (this.getExitBasedOnPos(pos) != e) {
                    console.log(roomName + ' failed')
                }
            }
        }
        
    },

    generateThreads: function(roomName) {
        let name = 'pathFinder-' + roomName + '-build_cost_matrix';
        if (!os.existsThread(name)) {
            const f = function() {
                pathGenerator.build_cost_matrix(roomName, true);
            }
            os.newTimedThread(name, f, 10, 0, 40); // spawn a new timed thread that runs every 40 ticks
        }
        
    }
};
module.exports = pathGenerator;

Creep.prototype.moveByPath = function(path) {
    if(_.isArray(path) && path.length > 0 && (path[0] instanceof RoomPosition)) {
        var idx = _.findIndex(path, (i) => i.isEqualTo(this.pos));
        if(idx === -1) {
            if(!path[0].isNearTo(this.pos)) {
                return C.ERR_NOT_FOUND;
            }
        }
        idx++;
        if(idx >= path.length) {
            return C.ERR_NOT_FOUND;
        }

        return this.move(this.pos.getDirectionTo(path[idx]));
    }

    if(_.isString(path)) {
        path = Room.deserializePath(path);
    }
    if(!_.isArray(path)) {
        return C.ERR_INVALID_ARGS;
    }
    var cur = _.find(path, (i) => i.x - i.dx == this.pos.x && i.y - i.dy == this.pos.y);
    if(!cur) {
        return ERR_NOT_FOUND;
    }
    //pathGenerator.registerCreepDst(this, cur.x, cur.y)
    return this.move(cur.direction);
};