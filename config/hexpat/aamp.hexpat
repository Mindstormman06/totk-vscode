#pragma pattern_name AAMP Parameter File
#pragma pattern_author community

struct AampHeader {
    char magic[4];       // "AAMP"
    u32 version;
    u32 flags;
    u32 fileSize;
    u32 pioOffset;
    u32 parameterCount;
    u32 pioCount;
};

AampHeader header @ 0x00;
