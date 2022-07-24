const os = require('os');

const swampCostConst = 10;
const plainCost = 2;

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}

/*
class DualCostMatrix {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }

    get(x, y) {
        console.log('herm pathfinder')
        let aV = this.a.get(x, y);
        let bV = this.b.get(x, y);
        if (aV == 0) 
            return aB;
        else if (bV == 0) 
            return aV;
        return aV > bV ? aV : bV;
    }
}
*/

const pathGenerator = {

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
        const struct = creep.room.lookForAt(LOOK_STRUCTURES, dstX, dstY);
        if (struct.length > 0) {
            for (s in struct) {
                if (struct[s].structureType in obsticalD) {
                    range = 1;
                    break;
                }
            }
        }
        
        const v = PathFinder.search(creep.pos, {'pos': new RoomPosition(dstX, dstY, creep.pos.roomName), 'range': range},
            {
                plainCost: plainCost,
                swampCost: opts.swampCost,
                roomCallback: function(roomName) {
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
        if (!(creep.room.name in convertedPath)) {
            return Room.serializePath([]);
        }
        const p = Room.serializePath(convertedPath[creep.room.name]);
        return p;
    },
    
    find_highway: function(pos, dstRoom) {
        // We want to see if a path to the dstRoom already exists if not we need to create it
        // We are just going to set it to the middle of the room
        // todo in the future come up with a better way to do this
        if (Memory.highway == null) {
            Memory.highway = {}; // will be starting_room: {dst_room: [starting room pos, Pathfinder path]}
        }
        
        if (Memory.costMatrix == null) {
            Memory.costMatrix = {};
        }
        
        if (!(pos.roomName in Memory.highway)) {
            Memory.highway[pos.roomName] = {}
        }
        
        if (dstRoom in Memory.highway[pos.roomName]) {
            // destination exists lets return it
            return Memory.highway[pos.roomName][dstRoom];
        }
        
        Memory.highway[pos.roomName][dstRoom] = {};
        
        // We need to create one, in future will precalculate this
        // lets take the creep position and then from that
        const v = PathFinder.search(pos, new RoomPosition(23, 23, dstRoom),
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

        if (v.incomplete) {
            return Room.serializePath([]);
        }
        
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
        
        // set the start path 
        Memory.highway[pos.roomName][dstRoom].start = v.path[startPos];
        if (endPos - startPos > 1) {
            // room is not next to eachother
            
            const roomsPaths = this.convertPathFinderSearch(v.path[startPos], v.path.slice(startPos+1, endPos));
            
            // now what we want to do is serialize for memory saving
            const serializedRoomPaths = {};
            for (const r in roomsPaths) {
                serializedRoomPaths[r] = Room.serializePath(roomsPaths[r].slice(1));
            }
            
            Memory.highway[pos.roomName][dstRoom].paths = serializedRoomPaths;
            Memory.highway[pos.roomName][dstRoom].cost = v.cost;
            // set first position in the destination
            Memory.highway[pos.roomName][dstRoom].end = v.path[endPos];
        } else {
            Memory.highway[pos.roomName][dstRoom].end = v.path[startPos + 1];
        }
        return Memory.highway[pos.roomName][dstRoom];
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

    test: function() {
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
        return JSON.stringify(v);
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