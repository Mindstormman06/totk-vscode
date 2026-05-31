#pragma pattern_name SARC Archive
#pragma pattern_author community

struct SarcHeader {
    char magic[4];       // "SARC"
    u16 headerSize;
    u16 byteOrder;
    u32 fileSize;
    u32 dataOffset;
    u32 version;
};

struct SFATHeader {
    char magic[4];       // "SFAT"
    u16 headerSize;
    u16 nodeCount;
    u32 hashMultiplier;
};

struct SFATNode {
    u32 nameHash;
    u32 fileAttrs;
    u32 startOffset;
    u32 endOffset;
};

struct Sarc {
    SarcHeader header;
    SFATHeader sfatHeader;
    SFATNode nodes[sfatHeader.nodeCount];
};

Sarc sarc @ 0x00;
