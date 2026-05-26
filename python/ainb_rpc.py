import argparse
import json
import sys
from pathlib import Path

# Add vendor ainb library to sys.path so we can import it directly.
_VENDOR_AINB = str(Path(__file__).resolve().parent.parent / 'vendor' / 'ainb')
if _VENDOR_AINB not in sys.path:
    sys.path.insert(0, _VENDOR_AINB)

from ainb.ainb import AINB
from ainb.node import Node, NodeType

def handle_rpc(file_path: str, command_str: str):
    try:
        command = json.loads(command_str)
        action = command.get("action")
        payload = command.get("payload", {})

        # Load the graph
        ainb_file = AINB.from_json(file_path)

        # Route the actions mapped to your Editing API
        if action == "link_nodes":
            src_idx = int(payload["source"].replace("node-", ""))
            tgt_idx = int(payload["target"].replace("node-", ""))
            
            src_node = ainb_file.get_node(src_idx)
            tgt_node = ainb_file.get_node(tgt_idx)
            
            if src_node and tgt_node:
                # Using your node.py API
                src_node.link_child(tgt_node, connection_name="Linked")

        elif action == "remove_node":
            node_idx = int(payload["nodeId"].replace("node-", ""))
            ainb_file.remove_node(node_idx)

        elif action == "add_node":
            # Just an example of spawning a basic action node
            node_type_name = payload.get("nodeType", "UserDefined")
            new_node = Node(NodeType[node_type_name])
            new_node.name = payload.get("name", "NewNode")
            ainb_file.add_node(new_node)

        elif action == "edit_node_param":
            node_idx = payload.get("nodeId")
            param_group = payload.get("paramType") # e.g., 'float Input Parameters'
            param_name = payload.get("paramName")
            new_val = payload.get("newValue")

            node = ainb_file.get_node(node_idx)
            if node:
                # Map the string 'float Input Parameters' to ParamType.Float
                from ainb.param_common import ParamType
                clean_type = param_group.lower().split(" ")[0]
                
                # Simple mapper to your enum
                type_map = {
                    "bool": ParamType.Bool,
                    "float": ParamType.Float,
                    "int": ParamType.Int,
                    "string": ParamType.String,
                    "vec3f": ParamType.Vec3f
                }
                
                p_type = type_map.get(clean_type)
                if p_type:
                    # Update it using your API
                    node.update_input_default(p_type, param_name, new_val)

        else:
            raise ValueError(f"Unknown RPC action: {action}")

        # Save it back (this triggers VS Code's onDidChangeTextDocument)
        ainb_file.save_json(override_filename=file_path)
        print(json.dumps({"status": "success", "action": action}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to the AINB JSON file")
    parser.add_argument("--command", required=True, help="JSON string of the RPC command")
    args = parser.parse_args()

    handle_rpc(args.file, args.command)