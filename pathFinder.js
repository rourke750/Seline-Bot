const pathGenerator = {
    
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
                plainCost: 2,
                swampCost: 10,
                roomCallback: function(roomName) {
                    if (roomName in Memory.costMatrix)
                        return PathFinder.CostMatrix.deserialize(Memory.costMatrix[roomName]);
                    return null;
                }
            }
        )
        
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
                serializedRoomPaths[r] = Room.serializePath(roomsPaths[r]);
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
    
    build_cost_matrix: function(roomName) {
        // We want to build a cost matrix per room and then save to memory
        
        // todo in the future we will want to be able to invalidate a room
        
        if (Memory.costMatrix == null || Memory.costMatrix == unknown) {
            Memory.costMatrix = {};
        }
        
        if (roomName in Memory.costMatrix)
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

        // Avoid creeps in the room
        //room.find(FIND_CREEPS).forEach(function(creep) {
        //  costs.set(creep.pos.x, creep.pos.y, 0xff);
        //});

        if (Memory.costMatrix == null || Memory.costMatrix == unknown) {
            Memory.costMatrix = {};
        }
        Memory.costMatrix[roomName] = costs.serialize();
        return true;
    },
};
/*
let ret = PathFinder.search(
        creep.pos, goals,
        {
          // We need to set the defaults costs higher so that we
          // can set the road cost lower in `roomCallback`
          plainCost: 2,
          swampCost: 10,
    
          roomCallback: function(roomName) {
    
            let room = Game.rooms[roomName];
            // In this example `room` will always exist, but since 
            // PathFinder supports searches which span multiple rooms 
            // you should be careful!
            if (!room) return;
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
    
            // Avoid creeps in the room
            room.find(FIND_CREEPS).forEach(function(creep) {
              costs.set(creep.pos.x, creep.pos.y, 0xff);
            });
    
            return costs;
          },
        }
      );
      */
module.exports = pathGenerator;