const utils = require('utils');
const common = require('common');
const pathFinder = require('pathFinder');
const os = require('os');

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}
const roadStructs = {};
roadStructs[STRUCTURE_ROAD] = true;
const containerStructs = {};
containerStructs[STRUCTURE_CONTAINER] = true;
const wallRampartStructs = {};
wallRampartStructs[STRUCTURE_RAMPART] = true;
wallRampartStructs[STRUCTURE_WALL] = true;
 
var construction = {

    build_missing_spawn: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller) {
            return;
        }
        if (room.controller.my && room.memory.spawnMaster == null && room.name in Memory.flags.capture) {
            // let's try place a master spawn
            // lets see if there is a flag we were just captured
            const flags = room.find(FIND_FLAGS);
            let f = null;
            for (const fK in flags) {
                const flag = flags[fK];
                if (flag.name.startsWith('Capture')) {
                    f = flag;
                    break
                }
            }
            room.memory['spawnMasterX'] = f.pos.x;
            room.memory['spawnMasterY'] = f.pos.y;
            room.memory['spawnMaster'] = `${room.name}-1`;
            f.remove();
        }
    },

    doesConstructionExistAndCantBuild: function(room, pos, additionalStructs={}) { // return true if there is already a struct there or a construction site
        if(!Array.isArray(pos)) { // check if we send a roomPosition 
            const temp = [];
            temp.push(pos.x);
            temp.push(pos.y);
            pos = temp;
        }
        const struct = room.lookForAt(LOOK_STRUCTURES, pos[0], pos[1]);
        const c = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos[0], pos[1]);
        let found = false;
        for (const s in struct) {
            const v = struct[s];
            if (v.structureType in obsticalD || v.structureType in additionalStructs) {
                found = true;
                continue;
            }
        }
        return (c.length > 0 || found)
    },

    // build a link near the spawns and roads that are needed
    buildAuxNearSpawn: function(room) {
        // we want to build a link and roads around the spawn
        if (room.memory.spawnMaster == null) {
            return;
        }

        if (construction.doesMemoryExistConstructon(room.name, 'auxnearspawns')) {
            return;
        }

        const paths = [];

        const mergedFoundStructs = Object.assign({}, roadStructs, containerStructs);

        const linkLoc = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+2);
        //linkLoc.createConstructionSite(STRUCTURE_LINK);
        if (!this.doesConstructionExistAndCantBuild(room, linkLoc, mergedFoundStructs)) {
            paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+2, STRUCTURE_LINK]);
        }

        const structs = linkLoc.lookFor(LOOK_STRUCTURES);
        let link_id = null;
        for (const i in structs) {
            const v = structs[i];
            if (v.structureType == 'link') {
                link_id = v.id;
                break;
            }
        }
        if (link_id != null) {
            room.memory.masterLink = link_id;
        }

        // try build roads
        // we want a diagonal up each point
        for (let i = 1; i <= 7; i += 2) {
            let positions = utils.buildLineDirection(room.memory.spawnMasterX, room.memory.spawnMasterY+1, i, 4)
            for (const ii in positions) {
                const v = positions[ii];
                if (this.doesConstructionExistAndCantBuild(room, v, roadStructs)) // if we are already constructing we do not want to call this method
                    continue;
                paths.push([v[0], v[1], STRUCTURE_ROAD]);
                //room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
            }
        }
        //room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1).createConstructionSite(STRUCTURE_ROAD);
        if (!this.doesConstructionExistAndCantBuild(room, linkLoc, roadStructs))
            paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+1, STRUCTURE_ROAD]);

        // build roads around spawns
        const posOffset = [[0, 3], [-1, -2], [0, -1], [1, 4]]
        for (let i = 1; i <= 7; i += 2) {
            const pOff = posOffset[parseInt(i/2)]
            let positions = utils.buildLineDirection(room.memory.spawnMasterX + pOff[0], room.memory.spawnMasterY+pOff[1], i, 2)
            for (const ii in positions) {
                const v = positions[ii];
                if (this.doesConstructionExistAndCantBuild(room, v, roadStructs))
                    continue;
                //room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
                paths.push([v[0], v[1], STRUCTURE_ROAD]);
            }
            //new RoomVisual(room.name).poly(positions, {stroke: '#000000', strokeWidth: .8, 
            //    opacity: .9});
        }

        // build defense towers

        // build storage container
        if (!this.doesConstructionExistAndCantBuild(room, [room.memory.spawnMasterX, room.memory.spawnMasterY+1], mergedFoundStructs)) {
            paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+1, STRUCTURE_CONTAINER]);
        }

        // build main storage
        if (!this.doesConstructionExistAndCantBuild(room, [room.memory.spawnMasterX+1, room.memory.spawnMasterY+5], mergedFoundStructs)) {
            paths.push([room.memory.spawnMasterX+1, room.memory.spawnMasterY+5, STRUCTURE_STORAGE]);
        }

        // send off to memory
        construction.buildMemoryConstruction(room.name, 'auxnearspawns', paths);
    },

    // This function handles building the spawn
    buildSpawnCenter: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) 
            return;
        if (construction.doesMemoryExistConstructon(roomName, 'spawns')) {
            return;
        }

        let maxSpawns = 1;
        if (!room.controller || !room.controller.my) {
            return;
        } else if (room.controller.level == 7) {
            maxSpawns = 2;
        } else if (room.controller.level == 8) {
            maxSpawns = 3;
        }

        const spawns = [];
        for (const k in Game.spawns) {
            const spawn = Game.spawns[k];
            if (spawn.room.name != room.name) {
                continue;
            }
            spawns.push(spawn);
        }

        if (spawns.length == 1 && room.memory.spawnMaster == null) {
            room.memory.spawnMaster = spawns[0].name;
            room.memory.spawnMasterX = spawns[0].pos.x;
            room.memory.spawnMasterY = spawns[0].pos.y;
        }
        
        if (spawns.length >= maxSpawns) {
            // we have all our spawns
            return;
        }

        const paths = [];

        // check if the master spawn is still there or if it was ever there, if not rebuild it 
        if ((room.memory.spawnMaster == null && room.memory.spawnMasterX != null) || 
            (room.memory.spawnMaster != null && !Game.spawns[room.memory.spawnMaster])) {
            // we are missing the master spawn rebuild it
            const n = `${room.name}-1`;
            // room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY).createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY, STRUCTURE_SPAWN]);
            room.memory.spawnMaster = n;
        }
        const m = Game.spawns[room.memory.spawnMaster];
        if (m == null) {
            construction.buildMemoryConstruction(room.name, 'spawns', paths);
            return;
        }
        // check for bottom left spawn if we can build it

        let secondLocation = room.getPositionAt(m.pos.x-1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-2`;
            //secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([m.pos.x-1, m.pos.y+1, STRUCTURE_SPAWN]);
        }
        // check for bottom right spawn if we can build it
        secondLocation = room.getPositionAt(m.pos.x+1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-3`;
            //secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([m.pos.x+1, m.pos.y+1, STRUCTURE_SPAWN]);
        }
        construction.buildMemoryConstruction(room.name, 'spawns', paths);
    },

    find_spawns_at_pos: function(room, pos) {
        const secondLocation = room.lookAt(pos);
        for (const sL in secondLocation) {
            const sV = secondLocation[sL];
            if (sV.type == LOOK_STRUCTURES && sV.structure.structureType == 'spawn') {
                return true;
            } else if (sV.type == LOOK_CONSTRUCTION_SITES && sV.constructionSite.structureType == 'spawn') {
                return true;
            }
        }
        return false;
    },
    
    build_link_near_sources: function(source) {
        /* goal of this method is to build a link that will match up with with a source and is close to the spawn, 
        then haulers can carry energy to where its needed
        */
        /*
        for (const f in Game.flags) {
            if (Game.flags[f].pos.roomName == 'W3N7') {
                Game.flags[f].remove()
            }
        }
        */
        //pos.createFlag();
        if (!source.room.controller) {
            return;
        }
                
        if (!((Game.time + 40) % 1000 == 0 && source.room.controller.level >= 6)) {
            return
        }
        
        if (Memory.rooms[source.room.name].sources == null || Memory.rooms[source.room.name].sources == undefined) {
            Memory.rooms[source.room.name].sources = {};
        }
        
        if (!(source.id in Memory.rooms[source.room.name].sources)) {
            Memory.rooms[source.room.name].sources[source.id] = {}
        }
        
        // check the building if its finished
        const structs = source.room.lookForAt(
            LOOK_STRUCTURES, Memory.rooms[source.room.name].sources[source.id].container_x, 
            Memory.rooms[source.room.name].sources[source.id].container_y).map(f => f.structureType);
        var found = false
        for (const s in structs) {
            if (structs[s] == STRUCTURE_LINK) {
                found = true;
                break;
            }
        }
        Memory.rooms[source.room.name].sources[source.id].finished = found;
        if (found)
            return;
        
        //todo change the above logic where only if it is found does the below code not run
        
        const spawns = source.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) && 
                            structure.room.name == source.room.name;
                        }
                    });
        if (spawns == null) {
            console.log('why is spawns null ' + source.room.name + ' ' + source.id);
            return;
        }
        
        const mem = Memory.rooms[source.room.name].sources[source.id];

        var pos;
        if (mem.container_x == null || mem.container_y == null) {
            const path = source.pos.findPathTo(spawns[0], utils.movement_options);
            pos = new RoomPosition(path[1].x, path[1].y, source.room.name);
            mem.container_x = pos.x;
            mem.container_y = pos.y;
        } else {
            pos = new RoomPosition(mem.container_x, mem.container_y, source.room.name);
        }
        
        const conErr = pos.createConstructionSite(STRUCTURE_LINK)
        if (conErr != 0) {
            console.log('failed to create construction site for STRUCTURE_LINK ' + conErr);
            // it shouldnt create one without x, y being set as well.
            return;
        }
        mem.finished = false;
    },
    
    get_available_extentions_build: function(room) {
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION });
        const in_progress = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION })
        
        var extensionCount;
        switch (room.controller.level) {
        case 2:
            extensionCount = 5;
            break;
        case 3:
            extensionCount = 10;
            break;
        default:
            extensionCount = (room.controller.level - 2) * 10;
            break;
        }
        return extensionCount - extensions.length - in_progress.length;
    },
    
    build_exensions_success: function(results) {
        if (results == ERR_INVALID_TARGET) {
            console.log('error spawning extension attempting new location');
        } else if (results == OK) {
            console.log('found valid extension location');
            return true;
        } else {
            console.log('Unknown location with error ' + results);
        }
        return false
    },

    get_extension_positions: function(x, y, xDir, yDir) {
        const positions = [];
        for (var xx = 1; xx < 4; xx++) {
            positions.push([x + (xx * xDir), y - (xx * yDir)])
            positions.push([x + (xx * xDir), y - (xx * yDir) - (1 * yDir)])
        }
        positions.push([x + (4* xDir), y - (4 *yDir)])
        positions.push([x + (5* xDir), y - (4 *yDir)])
        positions.push([x + (5* xDir), y - (3 *yDir)])
        for (var xx = 4; xx >= 2; xx--) {
            positions.push([x + (xx * xDir) + (1*xDir), y - (xx * yDir) + (2*yDir)])
            positions.push([x + (xx * xDir), y - (xx * yDir) + (2*yDir)])
        }
        return positions;
    },
    
    build_extensions: function(room) {

        if (!room.controller || !room.controller.my)
            return;

        // todo build that cool design i saw 

        //todo use flag to premap how it will look
        var to_build = this.get_available_extentions_build(room);
        if (to_build == 0) {
            return;
        }
        
        // check if we already have the paths in the process of being built
        if (construction.doesMemoryExistConstructon(room.name, 'extensions')) {
            return;
        }

        const x = room.memory.spawnMasterX;
        const y = room.memory.spawnMasterY;
        
        const positions = []; // the positions to build exentions
        const paths = []; // the array to place the structures in memory

        positions.push(...this.get_extension_positions(x, y, 1, 1));
        positions.push(...this.get_extension_positions(x, y+2, 1, -1));
        positions.push(...this.get_extension_positions(x, y, -1, 1));
        positions.push(...this.get_extension_positions(x, y+2, -1, -1));
        for (var i = 0; i < positions.length; i++) {
            //var results = room.createConstructionSite(positions[i][0], positions[i][1], STRUCTURE_EXTENSION);
            paths.push([positions[i][0], positions[i][1], STRUCTURE_EXTENSION]);
            /*
            if (results == 0) {
                to_build--;
            }
            if (to_build == 0) 
                break
            */
        }
        construction.buildMemoryConstruction(room.name, 'extensions', paths);
        //new RoomVisual(room.name).poly(positions, {stroke: '#fff', strokeWidth: .15,
          //      opacity: .2, lineStyle: 'dashed'});
    },

    buildRoadFromMasterSpawnToSources: function(room) {
        if (room.memory.spawnMaster == null || !room.controller.my) {
            return;
        }

        if (construction.doesMemoryExistConstructon(room.name, 'roadsfrommastertosources')) {
            return;
        }

        const memoryPaths = [];

        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};
        const sources = room.find(FIND_SOURCES);
        let sCost;
        if (Memory.construction && room.name in Memory.construction && Memory.construction[room.name].costMatrix) {
            sCost = Memory.construction[room.name].costMatrix
        }
        for (const sourceKey in sources) {
            const sourceV = sources[sourceKey];
            const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, sourceV.pos.x, sourceV.pos.y, 
                {swampCost:2}));
            for (var i = 0; i < paths.length; i++) {
                const path = paths[i];
                const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
                const struct = room.lookForAt(LOOK_STRUCTURES, path.x, path.y);
                if (ter != 'wall' && struct.length == 0) {
                    //room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                    memoryPaths.push([path.x, path.y, STRUCTURE_ROAD]);
                }
            }
        }
        construction.buildMemoryConstruction(room.name, 'roadsfrommastertosources', memoryPaths);
    },

    buildRoadsFromMasterSpawnToController: function(room) {
        if (room.memory.spawnMaster == null || !room.controller.my) {
            return;
        }

        if (construction.doesMemoryExistConstructon(room.name, 'roadsfrommastertocontroller')) {
            return;
        }

        const memoryPaths = [];
        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};
        let sCost;
        if (Memory.construction && room.name in Memory.construction && Memory.construction[room.name].costMatrix) {
            sCost = Memory.construction[room.name].costMatrix
        }
        const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, room.controller.pos.x, room.controller.pos.y, 
            {swampCost:2}));
        for (var i = 0; i < paths.length; i++) {
            const path = paths[i];
            const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
            const struct = room.lookForAt(LOOK_STRUCTURES, path.x, path.y);
            if (ter != 'wall' && struct.length == 0) {
                //room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                memoryPaths.push([path.x, path.y, STRUCTURE_ROAD]);
            }
        }
        construction.buildMemoryConstruction(room.name, 'roadsfrommastertocontroller', memoryPaths);
    },
    
    remove_old_roads: function(room) {
        // cleanup old roads that are on buildings as they are untraversable so why upkeep
        // todo delete roads that are covering structures that cant be crossed
        const road_paths = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_ROAD;
            }
        });
        
        for (const k in road_paths) {
            const struct = room.lookForAt(LOOK_STRUCTURES, road_paths[k].pos.x, road_paths[k].pos.y)
            var impassible = false;
            if (struct.length > 1) {
                for (s in struct) {
                    if (struct[s].structureType in obsticalD) {
                        impassible = true;
                        break;
                    }
                }
                if (impassible)
                    road_paths[k].destroy();
            }
        }
    },

    buildRoadsFromMasterSpawnToExits: function(room) {
        // first let's check check highway
        if (Memory.highway == null || !room.controller || !room.controller.my) {
            // no highway just exit
            return;
        }

        if (construction.doesMemoryExistConstructon(room.name, 'roadsfrommastertoexits')) {
            return;
        }

        const memoryPaths = [];

        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};

        const currentRoom = Memory.highway[room.name];
        let sCost;
        if (Memory.construction && room.name in Memory.construction && Memory.construction[room.name].costMatrix) {
            sCost = Memory.construction[room.name].costMatrix
        }
        for (const roomK in currentRoom) {
            const roomV = currentRoom[roomK];
            const start = roomV.start;
            if (start != null) {
                // build road from master spawn to start
                const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, start.x, start.y, 
                    {swampCost:2}));
                for (var i = 1; i < paths.length - 1; i++) {
                    const path = paths[i];
                    if (this.doesConstructionExistAndCantBuild(room, path, roadStructs))
                        continue;
                    const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
                    if (ter != 'wall') {
                        memoryPaths.push([path.x, path.y, STRUCTURE_ROAD]);
                    }
                }
            }
        }
        
        construction.buildMemoryConstruction(room.name, 'roadsfrommastertoexits', memoryPaths);
    },

    buildWallsAndRamparts: function(roomName) {
        if (roomName != "W3N7") {
            return;
        }

        if (construction.doesMemoryExistConstructon(roomName, 'wallsAndRamparts')) {
            return;
        }

        // todo scan each side and build the wall
        const room = Game.rooms[roomName]; 
        if (!room || !room.controller || !room.controller.my) {
            return;
        }
        const t = room.getTerrain();
        const exits = Game.map.describeExits(roomName);

        const eMap = {
            "1" : [0, 0, 2],
            "3" : [49, 0, 4],
            "5" : [0, 49, 2],
            "7" : [0, 0, 4],
        };

        for (const eK in exits) {
            let tmpPositions = utils.buildLineDirection(eMap[eK][0], eMap[eK][1], eMap[eK][2], 48);
            let tArray = null;
            const positionsArray = [];
            for (let k = tmpPositions.length - 1; k >= 0; k--) {
                const posi = tmpPositions[k];
                //const p = room.getPositionAt(posi[0], posi[1]);
                if (t.get(posi[0], posi[1]) == TERRAIN_MASK_WALL) {
                    if (tArray != null) {
                        positionsArray.push(tArray);
                        tArray = null;
                    }
                } else {
                    if (tArray == null) {
                        tArray = [];
                    }
                    if (eK == "1") {
                        posi[1] += 2;
                    } else if (eK == "3") {
                        posi[0] -= 2;
                    } else if (eK == "5") {
                        posi[1] -= 2;
                    } else {
                        posi[0] += 2;
                    }
                    tArray.push(posi);
                }
            }
            if (tArray != null) {
                positionsArray.push(tArray);
                tArray = null;
            }
            
            let xMod = 0;
            let yMod = 0;
            for (const positionKey in positionsArray) {
                const positions = positionsArray[positionKey];
                const lastPostion = positions[0];
                const firstPostion = positions[positions.length - 1];
                if (eK == "1") { // top
                    for (let y = 0; y <= 2; y++) {
                        positions.push([lastPostion[0]+2, lastPostion[1]-y])
                        positions.unshift([firstPostion[0]-2, firstPostion[1]-y])
                    }
                    positions.push([lastPostion[0]+1, lastPostion[1]])
                    positions.unshift([firstPostion[0]-1, firstPostion[1]])
                    yMod = 2;
                } else if (eK == "3") { // right
                    for (let y = 0; y <= 2; y++) {
                        positions.push([firstPostion[0]+y, firstPostion[1]-2])
                        positions.unshift([lastPostion[0]+y, lastPostion[1]+2])
                    }
                    positions.push([lastPostion[0], lastPostion[1]+1])
                    positions.unshift([firstPostion[0], firstPostion[1]-1])
                    xMod = 47;
                } else if (eK == "5") { // bottom
                    for (let y = 0; y <= 2; y++) {
                        positions.push([lastPostion[0]+2, lastPostion[1]+y])
                        positions.unshift([firstPostion[0]-2, firstPostion[1]+y])
                    }
                    positions.push([lastPostion[0]+1, lastPostion[1]])
                    positions.unshift([firstPostion[0]-1, firstPostion[1]])
                    yMod = 47;
                } else { //left
                    for (let y = 0; y <= 2; y++) {
                        positions.push([firstPostion[0]-y, firstPostion[1]-2])
                        positions.unshift([lastPostion[0]-y, lastPostion[1]+2])
                    }
                    positions.push([lastPostion[0], lastPostion[1]+1])
                    positions.unshift([firstPostion[0], firstPostion[1]-1])
                    xMod = 2;
                }
            }

            // generate an exit if one doesn't exist in order for the rampart to be placed
            if (Memory.highway[roomName][exits[eK]] == null) {
                pathFinder.find_highway(room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), exits[eK]);
            }
            // we will discover where to place rampart based on the location of the path from spawn to exit
            const start = Memory.highway[roomName][exits[eK]].start;
            const pathToExit = Room.deserializePath(pathFinder.find_path_in_room({
                pos: {x:room.memory.spawnMasterX, y:room.memory.spawnMasterY, roomName:roomName}, room:room
            },
            start.x, start.y
            ));
            let startX;
            let startY;

            // this logic is used to find from the exit to the spawn, we work backwards as the position we want is at the end of the array
            for (let i = pathToExit.length - 1; i > pathToExit.length/2; i--) {
                const v = pathToExit[i];
                if ((xMod == 0 && v.y == yMod) || (yMod == 0 && v.x == xMod)) {
                    startX = v.x;
                    startY = v.y;
                    break;
                }
            }

            const memoryArray = [];

            for (const positionKey in positionsArray) {
                const positions = positionsArray[positionKey];
                for (const pK in positions) {
                    const pv = positions[pK];

                    if (this.doesConstructionExistAndCantBuild(room, pv, wallRampartStructs)) 
                        continue;

                    const ter = room.lookForAt(LOOK_TERRAIN, pv[0], pv[1]);
                    if (ter == 'wall') {
                        continue;
                    }

                    if (pv[0] == startX && pv[1] == startY) {
                        // build rampart
                        memoryArray.push([pv[0], pv[1], STRUCTURE_RAMPART]);
                    } else {
                        memoryArray.push([pv[0], pv[1], STRUCTURE_WALL]);
                    }
                }
            }

            construction.buildMemoryConstruction(room.name, 'wallsAndRamparts', memoryArray);

            // todo add edges and go to wallhg
            //new RoomVisual(room.name).poly(positions, {stroke: '#000000', strokeWidth: .8, 
            //    opacity: .9});
        }
        
        //console.log(exits["1"])
        //let pos = pathFinder.find_highway(room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), ); //todo find room west of current

        
    },

    doesMemoryExistConstructon: function(roomName, name) {
        const c = Memory.construction;
        if (!c || !(roomName in c) || !(name in c[roomName].paths) || c[roomName].paths.length == 0)
            return false;
        return true;
    },

    /**
     * 
     * Method for construction methods to insert paths into memory to be built
     */
    buildMemoryConstruction: function(roomName, name, paths) {
        // validate if we need to continue
        if (paths == null || paths.length == 0) {
            return;
        }
        // initialize any needed memory objects
        if (!Memory.construction) {
            Memory.construction = {};
        }
        // create the construction memory tab if doesnt exist for a room
        if (!Memory.construction[roomName]) {
            Memory.construction[roomName] = {};
        }
        // create paths for where each type will create its roads
        if (!Memory.construction[roomName].paths) {
            Memory.construction[roomName].paths = {};
        }
        
        // check if paths array exists for the name and if it does create it
        let memoryPaths = Memory.construction[roomName].paths;
        if (!(name in memoryPaths)) {
            Memory.construction[roomName].paths[name] = [];
        }
        memoryPaths = memoryPaths[name];
        
        if (memoryPaths.length > 0) {// if it does exist exit
            return;
        }
        
        let costs = Memory.costMatrix[roomName];
        if (!costs) {
            pathFinder.build_cost_matrix(roomName);
            costs = Memory.costMatrix[roomName];
        }
        costs = PathFinder.CostMatrix.deserialize(costs);

        // add the roads to the cost matrix
        for (const k in paths) {
            const v = paths[k];
            if (v[2] == STRUCTURE_ROAD) {
                costs.set(v[0], v[1], 1);
            }
            memoryPaths.push(v);
        }
        Memory.costMatrix[roomName] = costs.serialize();
    },

    /** 
     * Method for building construction sites from memory
    */
    buildConstructionFromMemory(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return;
        }
        if (!Memory.construction || !Memory.construction[roomName]) {
            return;
        }
        const pathsArray = Memory.construction[roomName].paths;
        let count = room.find(FIND_CONSTRUCTION_SITES).length;
        
        for (const pathKey in pathsArray) {
            if (count >= common.maxConstructionsPerRoom) // break if we have constructed more than listed
                break;
            const paths = pathsArray[pathKey];
            for (let pKey = paths.length - 1; pKey >= 0; pKey--) {
                if (count >= common.maxConstructionsPerRoom) // break if we have constructed more than listed
                    break;
                const path = paths[pKey];
                paths.pop();
                room.getPositionAt(path[0], path[1]).createConstructionSite(path[2]);
                count++;
            }
            if (paths.length == 0) {
                Memory.construction[roomName].paths[pathKey] = undefined;
            }
        }
    },

    generateThreads: function(room) {
        const roomName = room.name;

        let name = 'construction-' + room.name + '-build_aux';
        if (!os.existsThread(name)) {
            const f = function() {
                const room = Game.rooms[roomName];
                if (!room) {
                    return;
                }
                construction.build_missing_spawn(roomName);
                construction.buildSpawnCenter(roomName); // hanldes building the spawns
                construction.build_extensions(room); // hanldes building the extensions
                // handles building the roads to extensions, towers, link near spawn, other center piece stuff
                construction.buildAuxNearSpawn(room);
                construction.buildRoadsFromMasterSpawnToExits(room);
                construction.buildRoadFromMasterSpawnToSources(room);
                construction.buildRoadsFromMasterSpawnToController(room);
            } 
            os.newTimedThread(name, f, 10, 1, 20); // spawn a new timed thread that runs every 20 ticks
        }

        name = 'construction-' + room.name + '-remove_old_roads';
        if (!os.existsThread(name)) {
            const f = function() {
                const room = Game.rooms[roomName];
                if (!room) {
                    return;
                }
                construction.remove_old_roads(room);
            } 
            os.newTimedThread(name, f, 10, 1, 30); // spawn a new timed thread that runs every 30 ticks
        }

        name = 'construction-' + room.name + '-build_walls_and_ramparts'
        if (!os.existsThread(name)) {
            const f = function() {
                construction.buildWallsAndRamparts(roomName);
            } 
            os.newTimedThread(name, f, 10, 1, 30); 
            //os.newThread(name, f, 10);
        }

        name = 'construction-' + room.name + '-construct_from_memory'
        if (!os.existsThread(name)) {
            const f = function() {
                construction.buildConstructionFromMemory(roomName);
            }
            os.newTimedThread(name, f, 10, 1, 20);
        }
    }
}

module.exports = construction;