const ROOM_TYPE = {
    UNOWNED: 0,
    RESERVED: 1,
    MY_RESERVATION: 2,
    OWNED: 3
}

const CONSTRUCTION_PRIORITY = {
    'spawns': 1,
    'extensions': 2,
}

const common = {
    roomMapping: ROOM_TYPE,
    maxConstructionsPerRoom: 5,
    username: 'rourke750',

    constructionPriority: CONSTRUCTION_PRIORITY,
}

module.exports = common;