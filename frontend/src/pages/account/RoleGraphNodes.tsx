import type { CSSProperties } from 'react';
import { Handle, Position, getBezierPath, type EdgeProps, type NodeProps } from 'reactflow';
import { AUX_HANDLE_IN, AUX_HANDLE_OUT, RECOVERY_HANDLE_IN, RECOVERY_HANDLE_OUT, RELATION_TYPES } from './roleGraphConfig';
import type { RoleEdgeData, RoleNodeData } from './roleGraphTypes';

export const GraphNode = ({ data }: NodeProps<RoleNodeData>) => {
  const spacing = 16;
  const isRoleNode = data.nodeType === 'role';
  const canLink = Boolean(data.canLink);
  const handleTypes = isRoleNode ? [...RELATION_TYPES] : [];
  const handleCount = isRoleNode ? handleTypes.length : 1;
  const minHeight = isRoleNode ? Math.max(72, (handleCount - 1) * spacing + 48) : 56;
  const secondary = data.nodeType === 'data' ? data.value : data.kind;
  const handleVisibilityClass = canLink ? '' : 'role-handle--hidden';
  return (
    <div className={`role-flow-node role-flow-node--${data.nodeType}`} style={{ minHeight }}>
      <Handle
        id={AUX_HANDLE_IN}
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        isConnectableEnd={false}
        className="role-handle role-handle-aux"
        style={{ '--edge-color': 'transparent' } as CSSProperties}
      />
      <Handle
        id={AUX_HANDLE_OUT}
        type="source"
        position={Position.Right}
        isConnectableStart={false}
        isConnectableEnd={false}
        className="role-handle role-handle-aux"
        style={{ '--edge-color': 'transparent' } as CSSProperties}
      />
      {handleTypes.map((relationType, index) => {
        const offset = (index - (handleTypes.length - 1) / 2) * spacing;
        const color = data.typeColors[relationType] ?? 'var(--ink)';
        return (
          <Handle
            key={`in-${relationType}`}
            id={`in-${relationType}`}
            type="target"
            position={Position.Left}
            isConnectableStart={canLink}
            isConnectableEnd={canLink}
            className={`role-handle role-handle-in ${handleVisibilityClass}`}
            style={{
              '--edge-color': color,
              '--port-offset': `${offset}px`
            } as CSSProperties}
          />
        );
      })}
      {handleTypes.map((relationType, index) => {
        const offset = (index - (handleTypes.length - 1) / 2) * spacing;
        const color = data.typeColors[relationType] ?? 'var(--ink)';
        return (
          <Handle
            key={`out-${relationType}`}
            id={`out-${relationType}`}
            type="source"
            position={Position.Right}
            isConnectableStart={canLink}
            isConnectableEnd={canLink}
            className={`role-handle role-handle-out ${handleVisibilityClass}`}
            style={{
              '--edge-color': color,
              '--port-offset': `${offset}px`
            } as CSSProperties}
          />
        );
      })}
      <span>{data.label}</span>
      {secondary && (
        <small className={data.nodeType === 'data' ? 'role-node-value' : 'role-node-kind'}>{secondary}</small>
      )}
    </div>
  );
};

export const RecoveryNode = ({ data }: NodeProps<RoleNodeData>) => {
  const canLink = Boolean(data.canLink);
  const secondary = data.nodeType === 'recovery_plan' ? 'Draft' : data.kind;
  const color = data.typeColors.RecoveryOwner ?? 'var(--ink)';
  const handleVisibilityClass = canLink ? '' : 'role-handle--hidden';
  return (
    <div className={`role-flow-node role-flow-node--${data.nodeType}`}>
      <Handle
        id={RECOVERY_HANDLE_IN}
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        isConnectableEnd={canLink}
        className={`role-handle role-handle-in ${handleVisibilityClass}`}
        style={{ '--edge-color': color } as CSSProperties}
      />
      <Handle
        id={RECOVERY_HANDLE_OUT}
        type="source"
        position={Position.Right}
        isConnectableStart={canLink}
        isConnectableEnd={false}
        className={`role-handle role-handle-out ${handleVisibilityClass}`}
        style={{ '--edge-color': color } as CSSProperties}
      />
      <span>{data.label}</span>
      {secondary && <small className="role-node-kind">{secondary}</small>}
    </div>
  );
};

export const RoleEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd
}: EdgeProps<RoleEdgeData>) => {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetPosition: targetPosition ?? Position.Left
  });
  return (
    <g className="react-flow__edge">
      <path
        id={id}
        className="react-flow__edge-path role-edge-path"
        d={path}
        markerEnd={markerEnd}
        style={{ stroke: data?.color }}
      >
        <title>{data?.relationType}</title>
      </path>
    </g>
  );
};
