import argparse
import base64
import json
import sys
from pathlib import Path

_VENDOR_AINB = str(Path(__file__).resolve().parent.parent / 'vendor' / 'ainb')
if _VENDOR_AINB not in sys.path:
    sys.path.insert(0, _VENDOR_AINB)

from ainb.ainb import AINB
from ainb.node import Node, NodeType


def _load_ainb(file_path: str | None, use_stdin: bool) -> tuple["AINB", bool]:
    """Load an AINB from stdin (raw binary) or from a file path.
    Returns (ainb_file, is_binary)."""
    if use_stdin:
        raw = sys.stdin.buffer.read()
        return AINB.from_binary(raw), True

    p = Path(file_path)
    is_binary = p.suffix.lower() == ".ainb"
    if is_binary:
        return AINB.from_file(file_path), True
    else:
        return AINB.from_json(file_path), False


def handle_rpc(file_path: str | None, command_str: str, use_stdin: bool = False):
    try:
        command = json.loads(command_str)
        action = command.get("action")
        payload = command.get("payload", {})

        if action == "to_json":
            ainb_file, _ = _load_ainb(file_path, use_stdin)
            print(json.dumps({
                "status": "success",
                "data": ainb_file.as_dict()
            }))
            return

        ainb_file, is_binary = _load_ainb(file_path, use_stdin)

        if action == "link_nodes":
            src_str = payload["source"]
            tgt_str = payload["target"]

            tgt_idx = int(tgt_str.replace("node-", ""))
            tgt_node = ainb_file.get_node(tgt_idx)

            if src_str.startswith("cmd-"):
                cmd_idx = int(src_str.replace("cmd-", ""))
                command = ainb_file.get_command(cmd_idx)
                if command and tgt_node:
                    command.root_node_index = tgt_node.index

            elif src_str.startswith("node-"):
                src_idx = int(src_str.replace("node-", ""))
                src_node = ainb_file.get_node(src_idx)
                if src_node and tgt_node:
                    src_node.link_child(tgt_node, connection_name="Linked")

        elif action == "remove_node":
            node_idx = int(payload["nodeId"].replace("node-", ""))
            ainb_file.remove_node(node_idx)

        elif action == "add_node":
            node_type_name = payload.get("nodeType", "UserDefined")
            new_node = Node(NodeType[node_type_name])
            new_node.name = payload.get("name", "NewNode")
            ainb_file.add_node(new_node)

        elif action == "edit_node_param":
            node_idx = payload.get("nodeId")
            param_group = payload.get("paramType")
            param_name = payload.get("paramName")
            new_val = payload.get("newValue")

            node = ainb_file.get_node(node_idx)
            if node:
                from ainb.param_common import ParamType
                clean_type = param_group.lower().split(" ")[0]
                type_map = {
                    "bool": ParamType.Bool,
                    "float": ParamType.Float,
                    "int": ParamType.Int,
                    "string": ParamType.String,
                    "vec3f": ParamType.Vec3f,
                }
                p_type = type_map.get(clean_type)
                if p_type:
                    node.update_input_default(p_type, param_name, new_val)

        else:
            raise ValueError(f"Unknown RPC action: {action}")

        out_binary = ainb_file.to_binary()
        b64_data = base64.b64encode(out_binary).decode("utf-8")
        json_model = ainb_file.as_dict()

        print(json.dumps({
            "status": "success",
            "action": action,
            "data": b64_data,
            "model": json_model,
        }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=False, help="Path to the AINB file")
    parser.add_argument("--stdin", action="store_true", help="Read raw AINB binary from stdin")
    parser.add_argument("--command", required=True, help="JSON string of the RPC command")
    args = parser.parse_args()

    handle_rpc(args.file, args.command, use_stdin=args.stdin)
