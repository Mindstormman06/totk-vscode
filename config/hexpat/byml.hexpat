#pragma pattern_name BYML Binary YAML
#pragma pattern_author community

struct BymlHeader {
    char magic[2];       // "BY" or "YB"
    u16 version;
    u32 hashOffset;
    u32 stringTableOffset;
    u32 pathsOffset;
    u32 rootOffset;
};

BymlHeader header @ 0x00;
