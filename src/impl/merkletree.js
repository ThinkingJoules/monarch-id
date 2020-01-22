import { aegis } from "../client";
import { encode } from "../util";
import { NULLHASH } from "../constants";

export class MerkleTree extends Array{
    constructor(merkleTree){
        if(Array.isArray(merkleTree))super(...merkleTree)
        else super()
    }
    async addLeaves(leaves,hashLeaves){
        this[0] = []
        this[0].length = leaves.length
        for (let i = 0; i < leaves.length; i++) {
            let leaf = leaves[i];
            if(hashLeaves && leaf !== null)leaf = await aegis.hash(toBuffer(leaf))
            this[0][i] = leaf
        }
        let nodes = this[0]
        while (nodes.length > 1) {

            const layerIndex = this.length
      
            this.push([])
      
            for (let i = 0; i < nodes.length; i += 2) {
                if (i + 1 === nodes.length) {
                    this[layerIndex].push(nodes[i])
                    continue
                }
                const left = nodes[i]
                const right = nodes[i + 1];
                const hash = await aegis.hash(Buffer.concat([left, right]))
                this[layerIndex].push(hash)
            }
        
            nodes = this[layerIndex]
        }
        return this
    }
    sparseProof(arrayOfIndices){
        let MT = this
        if(!this[0].length)throw new Error('Must addLeaves before generating proofs')
        const proof = []
        for (let i = 0; i < this.length; i++) {
            const layer = this[i];
            proof[i] = Array(layer.length)
            proof[i].fill(null)
        }
        for (const i of arrayOfIndices) {
            if(i>=this[0].length)continue
            proof[0][i] = this[0][i]//set leaf hash for value
            walkTree(i)//this will set the neighbor hash that we need for validation
        }
        return proof
        function walkTree(index){
            for (let i = 0; i <= MT.length; i++) {
                const layer = MT[i]
                const proofLayer = proof[i]
                if(i === MT.length-1){//root hash
                    if(proofLayer[0] === null)proofLayer[0] = layer[0]
                    break
                }
                const isRightNode = index % 2
                const pairIndex = (isRightNode ? index - 1 : index + 1)
    
                if (pairIndex < layer.length && !proofLayer[pairIndex]) {
                    proofLayer[pairIndex] = layer[pairIndex]
                }
                // set index to parent index
                index = (index / 2) | 0
            }
        }
    }
    mergeSparseProof(sparse){//must validate seperately
        //merge values and hashes to this tree
        for (let i = 0; i < sparse.length; i++) {
            const layer = sparse[i];
            const ourLayer = this[i] || []
            for (let j = 0; j < layer.length; j++) {
                const hash = layer[j];
                if(hash === null || ourLayer[j] !== null)continue //xor
                ourLayer[j] = hash
            }
        }
    }
    getRoot() {
        return this[this.length - 1][0] || NULLHASH
    }
    getLeaves(){
        return this[0]
    }
    static async verifySparseProof(proof){//just make sure hash structure is valid up to root
        for (let i = 0; i < proof[0].length; i++) {//tree hashes match
            const leafHash = proof[0][i]
            if(leafHash === null)continue
            if((await walkTree(i)))continue
            else return false            
        }
        return proof
        async function walkTree(index){
            for (let i = 0; i <= proof.length; i++) {
                const layer = proof[i]
                const isRightNode = index % 2
                const pairIndex = (isRightNode ? index - 1 : index + 1)
                if(pairIndex >= layer.length)continue
                const left = isRightNode ? layer[pairIndex] : layer[index]
                const right = isRightNode ? layer[index] : layer[pairIndex]
                let val = await aegis.hash(Buffer.concat([left, right]))

                let parentIdx = (index / 2) | 0
                let parent = proof[i+1][parentIdx]
                if(parent === null) proof[i+1][parentIdx] = val
                else return val.equals(parent)
                index = (index / 2) | 0
            }
            throw new Error('Invalid Sparse Proof') //should never get here
        }
    }  
}
function toBuffer(value){
    if(value instanceof Buffer)return value

    if(!(value instanceof Buffer) && value instanceof Uint8Array){
        return Buffer.from(value)
    }

    return encode(value,false,true)//encode to binary
}




class MerkleTree1 extends Array{
    constructor(leaves){
        if(!Array.isArray(leaves))[leaves]
        super(...leaves)
        //move tree layers in to main array (that way the whole tree can shipped over the wire)
    }
    async generateTree(){
        this.layers = [[]]
        for (let i = 0; i < this.length; i++) {
            this.layers[0].push(await aegis.hash(toBuffer(this[i])))
        }
        let nodes = this.layers[0]
        while (nodes.length > 1) {

            const layerIndex = this.layers.length
      
            this.layers.push([])
      
            for (let i = 0; i < nodes.length; i += 2) {
                if (i + 1 === nodes.length) {
                    this.layers[layerIndex].push(nodes[i])
                    continue
                }
                const left = nodes[i]
                const right = nodes[i + 1];
                const hash = await aegis.hash(Buffer.concat([left, right]))
                this.layers[layerIndex].push(hash)
            }
        
            nodes = this.layers[layerIndex]
        }
        return this
    }
    //getSubtree(array of indices)
    //verifySubtree(proof)
    sparseProof(arrayOfIndices){
        if(!this.layers)throw new Error('Must generateTree before generating proofs')
        let depth = Math.ceil(Math.log2(this.length))
        const proof = Array(depth+1).fill([])
        for (const i of arrayOfIndices) {
            proof[0][i] = this[i]
        }
        let layerLen = this.length
        for (let i = 1; i <= depth; i++) {
            proof[i] = Array(Math.ceil(layerLen))
            proof[i].fill(null)
            layerLen = layerLen / 2
        }
        for (const i of arrayOfIndices) {
            walkTree(i)
        }
        return proof
        function walkTree(index){
            for (let i = 1; i <= depth; i++) {
                const layer = this.layers[i-1]
                const proofLayer = proof[i]
                const isRightNode = index % 2
                const pairIndex = (isRightNode ? index - 1 : index + 1)
    
                if (pairIndex < layer.length && !proofLayer[pairIndex]) {
                    proofLayer[pairIndex] = layer[pairIndex]
                }
                // set index to parent index
                index = (index / 2) | 0
            }
        }
    }
    mergeSparseProof(sparse){
        for (let i = 0; i < sparse.length; i++) {
            const val = sparse[i];
            if(val === null)continue
            this[i] = val
        }
        for (let i = 0; i < sparse.layers.length; i++) {
            const layer = sparse.layers[i];
            const ourLayer = this.layers[i]
            for (let j = 0; j < layer.length; j++) {
                const hash = layer[j];
                if(!hash || ourLayer[j])continue //xor
                ourLayer[j] = hash
            }
        }
    }
    async verifyAllValues(){
        for (let i = 0; i < this.length; i++) {
            const val = this[i];
            this.layers[0][i] = await aegis.hash(val)
        }
    }
    async verifyLeaf(index,root){
        let val = await aegis.hash(this[index])
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i]
            if(!val.equals(layer[index]))return false
            const isRightNode = index % 2
            const pairIndex = (isRightNode ? index - 1 : index + 1)

            if (pairIndex < layer.length) {
                proofLayer[pairIndex] = layer[pairIndex]
            }
            // set index to parent index
            index = (index / 2) | 0
        }
        return true
    }
    getProof(leaf){//change to index?
        let index = this.indexOf(leaf)
        const proof = []

        if (index == -1) {
            return []
        }

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i]
            const isRightNode = index % 2
            const pairIndex = (isRightNode ? index - 1 : index + 1)

            if (pairIndex < layer.length) {
                let needed = layer[pairIndex]
                let el = isRightNode ? [needed,null] : [null,needed]
                proof.push(el)
            }
            // set index to parent index
            index = (index / 2) | 0
        }
        return proof
    }
    getRoot() {
        return this.layers[this.layers.length - 1][0] || Buffer.from([])
    }
    static async verifyProof(proof, value, root) {
        let targetHash = await aegis.hash(toBuffer(value))
        root = toBuffer(root)
    
        if (!(Array.isArray(proof) && root)) {
          throw new Error('Must provide a "proof" array, the "root" hash, and the value for which the proof was produced for')
        }
    
        for (let i = 0; i < proof.length; i++) {
            const el = proof[i]
            el[el.indexOf(null)] = targetHash
            targetHash = await aegis.hash(Buffer.concat(el));
        }
    
        return targetHash.equals(root)
    }
    
    
}