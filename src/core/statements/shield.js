import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../../constants"

let t1 = new Type()
t1.shape = IDS.shieldSignetShape

const describeShield = new Describe()
describeShield[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: t1,
    relaxPayloadShape:'pure',
    retractable:true,
    directAssertion:false,
    hashTags:[0,1],//allow a single index for payload retrieval
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Used to add additional encryption keys to this identity.',
    minWork:15
})
export const ShieldStmt = StmtGen(IDS.shieldStmt,describeShield)