import MBuffer from "../impl/mbuffer";

export const PID = MBuffer('MID',Buffer.alloc(18))

export const SHAPEID = Symbol('ShapeID')
export const SHAPECHAIN = Symbol('ShapeChain')
export const IMPURE = Symbol('KeyOverwrite')
export const NULLHASH = Buffer.from([227, 176, 196, 66, 152, 252, 28, 20, 154, 251, 244, 200, 153, 111, 185, 36, 39, 174, 65, 228, 100, 155, 147, 76, 164, 149, 153, 27, 120, 82, 184, 85]).slice(0,18)

//encoded true/false boolean hashes ([195] & [194], respectively)
export const TRUEHASH = Buffer.from([174, 63, 70, 25, 176, 65, 61, 112, 211, 0, 75, 145, 49, 195, 117, 33, 83, 7, 78, 69, 114, 91, 225, 59, 154, 20, 137, 120, 137, 94, 53, 158]).slice(0,18)
export const FALSEHASH = Buffer.from([197, 87, 231, 19, 128, 17, 43, 152, 14, 175, 17, 69, 250, 128, 98, 17, 48, 223, 189, 250, 30, 55, 93, 135, 174, 0, 24, 183, 198, 10, 193, 107]).slice(0,18)


function makeID(num){
    return MBuffer('STMTID',[PID,uintToBuff(num,6)])
}
export const IDS = {
    typeShape:makeID(128),
    shapeShape:makeID(129),
    describeShape:makeID(130),
    stmtShape:makeID(131),

    shapeStmt:makeID(256),

    describeStmt:makeID(257),

    shieldSignetShape:makeID(258),
    genesisShape:makeID(259),
    genesisStmt:makeID(260),
    
    retractStmt:makeID(261),

    signetStmt:makeID(262),
    shieldStmt:makeID(263),

    ackStmt:makeID(264),
    rnStmt:makeID(265),

    domainStmt:makeID(266),
    fealtyStmt:makeID(267),
    easeStmt:makeID(268),
    tenancyStmt:makeID(269),
    
    personShape:makeID(270),

}

