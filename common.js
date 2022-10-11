const ROOM_TYPE = {
    UNOWNED: 0,
    RESERVED: 1,
    MY_RESERVATION: 2,
    OWNED: 3
}

const CREEP_ROLE = {
    CAN_HARVESTER: 'canHarvester',
    TRANSPORT: 'transport',
    JANITOR: 'janitor'
}

const CONSTRUCTION_PRIORITY = {
    'spawns': 1,
    'extensions': 2,
}

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}

const common = {
    roomMapping: ROOM_TYPE,
    maxConstructionsPerRoom: 2,
    maxJanitors: 4,
    username: 'rourke750',

    constructionPriority: CONSTRUCTION_PRIORITY,
    creepRole: CREEP_ROLE,
    obsticalD: obsticalD,
}

module.exports = common;