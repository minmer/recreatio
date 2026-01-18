import type { FormEvent } from 'react';
import type { Edge, Node } from 'reactflow';
import type { Copy } from '../../content/types';
import type { PendingRoleShareResponse, RoleLedgerVerificationResponse, RoleParentsResponse } from '../../lib/api';
import { RELATION_TYPES } from './roleGraphConfig';
import type { ActionStatus, PendingLink, RoleEdgeData, RoleNodeData } from './roleGraphTypes';

type RoleGraphPanelState = {
  selectedNode: Node<RoleNodeData> | null;
  selectedEdge: Edge<RoleEdgeData> | null;
  pendingLink: PendingLink | null;
  actionStatus: ActionStatus;
  selectedRoleId: string | null;
  selectedRoleCanWrite: boolean;
  selectedRoleCanLink: boolean;
  selectedRecoveryPlanId: string | null;
  selectedRecoveryCanLink: boolean;
  selectedDataOwner: Node<RoleNodeData> | null;
  createOwnerId: string | null;
  pendingShares: PendingRoleShareResponse[];
  pendingState: 'idle' | 'working' | 'error';
  parents: RoleParentsResponse | null;
  parentsState: 'idle' | 'working' | 'error';
  verification: RoleLedgerVerificationResponse | null;
  verificationState: 'idle' | 'working' | 'error';
  edges: Edge<RoleEdgeData>[];
};

type RoleGraphPanelFormState = {
  newRoleNick: string;
  newRoleKind: string;
  newRoleRelation: string;
  newFieldType: string;
  newFieldValue: string;
  shareTargetRoleId: string;
  shareRelationType: string;
  dataValue: string;
};

type RoleGraphPanelFormSetters = {
  setNewRoleNick: (value: string) => void;
  setNewRoleKind: (value: string) => void;
  setNewRoleRelation: (value: string) => void;
  setNewFieldType: (value: string) => void;
  setNewFieldValue: (value: string) => void;
  setShareTargetRoleId: (value: string) => void;
  setShareRelationType: (value: string) => void;
  setDataValue: (value: string) => void;
};

type RoleGraphPanelHandlers = {
  onStartCreateRole: (ownerId: string) => void;
  onCancelCreateRole: () => void;
  onCreateRole: (event: FormEvent) => void;
  onAddField: (event: FormEvent) => void;
  onShareRole: (event: FormEvent) => void;
  onPrepareRecovery: (roleId: string) => void;
  onActivateRecovery: (planId: string) => void;
  onLoadPendingShares: () => void;
  onAcceptShare: (shareId: string) => void;
  onLoadParents: () => void;
  onDeleteParent: (parentRoleId: string) => void;
  onVerifyRole: () => void;
  onUpdateField: (event: FormEvent) => void;
  onDeleteField: () => void;
};

type RoleGraphPanelProps = {
  copy: Copy;
  state: RoleGraphPanelState;
  form: RoleGraphPanelFormState;
  setForm: RoleGraphPanelFormSetters;
  handlers: RoleGraphPanelHandlers;
};

export function RoleGraphPanel({ copy, state, form, setForm, handlers }: RoleGraphPanelProps) {
  const {
    selectedNode,
    selectedEdge,
    pendingLink,
    actionStatus,
    selectedRoleId,
    selectedRoleCanWrite,
    selectedRoleCanLink,
    selectedRecoveryPlanId,
    selectedRecoveryCanLink,
    selectedDataOwner,
    createOwnerId,
    pendingShares,
    pendingState,
    parents,
    parentsState,
    verification,
    verificationState,
    edges
  } = state;

  return (
    <aside className="role-panel">
      <h4>{copy.account.roles.panelTitle}</h4>
      {selectedNode && (
        <div className="role-panel-block">
          <strong>{selectedNode.data.label}</strong>
          {selectedNode.data.kind && selectedNode.data.nodeType !== 'data' && (
            <span className="hint">{selectedNode.data.kind}</span>
          )}
          {selectedNode.data.nodeType === 'data' && selectedNode.data.value && (
            <span className="hint">{selectedNode.data.value}</span>
          )}
          {selectedNode.data.nodeType === 'data' && selectedNode.data.roleId && (
            <span className="hint">
              {copy.account.roles.dataOwnerLabel}:{' '}
              {selectedDataOwner
                ? `${selectedDataOwner.data.label} (${selectedNode.data.roleId})`
                : selectedNode.data.roleId}
            </span>
          )}
          <span className="hint">{selectedNode.id}</span>
        </div>
      )}
      {selectedEdge && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.edgeTitle}</strong>
          <span className="hint">{selectedEdge.data?.relationType}</span>
          <span className="hint">
            {selectedEdge.source} {'->'} {selectedEdge.target}
          </span>
        </div>
      )}
      {pendingLink && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.linkDraftTitle}</strong>
          <span className="hint">{copy.account.roles.linkDraftHint}</span>
          <span className="hint">
            {pendingLink.sourceId} {'->'} {pendingLink.targetId}
          </span>
          <span className="hint">{pendingLink.relationType}</span>
        </div>
      )}
      {actionStatus.type !== 'idle' && (
        <div className={`status ${actionStatus.type === 'working' ? '' : actionStatus.type}`}>
          <strong>{copy.access.statusTitle}</strong>
          <span>{actionStatus.message ?? copy.access.statusReady}</span>
        </div>
      )}
      {!selectedNode && !selectedEdge && <p className="hint">{copy.account.roles.panelEmpty}</p>}
      {selectedNode && selectedNode.data.nodeType === 'role' && (
        <>
          {selectedRoleCanLink && selectedRoleCanWrite && (
            <>
              <button
                type="button"
                className="chip"
                onClick={() => handlers.onStartCreateRole(selectedNode.id)}
              >
                {copy.account.roles.createOwnedRole}
              </button>
              {createOwnerId && (
                <form className="role-panel-form" onSubmit={handlers.onCreateRole}>
                  <strong>{copy.account.roles.createRoleTitle}</strong>
                  <span className="hint">{copy.account.roles.createOwnedRoleHint}</span>
                  <label>
                    {copy.account.roles.createRoleNickLabel}
                    <input
                      type="text"
                      value={form.newRoleNick}
                      onChange={(event) => setForm.setNewRoleNick(event.target.value)}
                    />
                  </label>
                  <label>
                    {copy.account.roles.createRoleKindLabel}
                    <input
                      type="text"
                      value={form.newRoleKind}
                      onChange={(event) => setForm.setNewRoleKind(event.target.value)}
                    />
                  </label>
                  <label>
                    {copy.account.roles.createRoleRelationLabel}
                    <select
                      value={form.newRoleRelation}
                      onChange={(event) => setForm.setNewRoleRelation(event.target.value)}
                    >
                      {RELATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="role-panel-actions">
                    <button type="submit" className="chip">
                      {copy.account.roles.createRoleAction}
                    </button>
                    <button type="button" className="ghost" onClick={handlers.onCancelCreateRole}>
                      {copy.account.roles.cancelAction}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          {selectedRoleCanWrite && (
            <form className="role-panel-form" onSubmit={handlers.onAddField}>
              <strong>{copy.account.roles.dataAddTitle}</strong>
              <label>
                {copy.account.roles.dataFieldLabel}
                <input
                  type="text"
                  value={form.newFieldType}
                  onChange={(event) => setForm.setNewFieldType(event.target.value)}
                />
              </label>
              <label>
                {copy.account.roles.dataValueLabel}
                <input
                  type="text"
                  value={form.newFieldValue}
                  onChange={(event) => setForm.setNewFieldValue(event.target.value)}
                />
              </label>
              <button type="submit" className="chip">
                {copy.account.roles.dataAddAction}
              </button>
            </form>
          )}
          {selectedRoleCanWrite && selectedRoleCanLink && (
            <form className="role-panel-form" onSubmit={handlers.onShareRole}>
              <strong>{copy.account.roles.shareRoleTitle}</strong>
              <span className="hint">{copy.account.roles.shareRoleHint}</span>
              <label>
                {copy.account.roles.shareRoleTargetLabel}
                <input
                  type="text"
                  value={form.shareTargetRoleId}
                  onChange={(event) => setForm.setShareTargetRoleId(event.target.value)}
                />
              </label>
              <label>
                {copy.account.roles.shareRoleRelationLabel}
                <select
                  value={form.shareRelationType}
                  onChange={(event) => setForm.setShareRelationType(event.target.value)}
                >
                  {RELATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="chip">
                {copy.account.roles.shareRoleAction}
              </button>
            </form>
          )}
          {selectedRoleId && selectedRoleCanLink && (
            <button type="button" className="chip" onClick={() => handlers.onPrepareRecovery(selectedRoleId)}>
              {copy.account.roles.recoveryPrepareAction}
            </button>
          )}
        </>
      )}
      {selectedRecoveryPlanId && selectedRecoveryCanLink && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.recoveryPlanTitle}</strong>
          <span className="hint">{copy.account.roles.recoveryPlanHint}</span>
          <button type="button" className="chip" onClick={() => handlers.onActivateRecovery(selectedRecoveryPlanId)}>
            {copy.account.roles.recoveryActivateAction}
          </button>
        </div>
      )}
      {selectedRoleId && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.pendingTitle}</strong>
          <button type="button" className="chip" onClick={handlers.onLoadPendingShares}>
            {copy.account.roles.pendingAction}
          </button>
          {pendingState === 'working' && <span className="hint">{copy.account.roles.pendingWorking}</span>}
          {pendingState === 'error' && <div className="status error">{copy.account.roles.pendingError}</div>}
          {pendingState === 'idle' && pendingShares.length === 0 && (
            <span className="hint">{copy.account.roles.pendingEmpty}</span>
          )}
          {pendingShares.length > 0 && (
            <div className="role-panel-list">
              {pendingShares.map((share) => (
                <div key={share.shareId} className="role-ledger-row">
                  <span className="note">{share.sourceRoleId}</span>
                  <span className="hint">{share.relationshipType}</span>
                  {selectedRoleCanWrite && (
                    <button type="button" className="chip" onClick={() => handlers.onAcceptShare(share.shareId)}>
                      {copy.account.roles.pendingAccept}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {selectedRoleId && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.parentsTitle}</strong>
          <button type="button" className="chip" onClick={handlers.onLoadParents}>
            {copy.account.roles.parentsAction}
          </button>
          {parentsState === 'working' && <span className="hint">{copy.account.roles.parentsWorking}</span>}
          {parentsState === 'error' && <div className="status error">{copy.account.roles.parentsError}</div>}
          {parents && parents.parentRoleIds.length === 0 && <span className="hint">{copy.account.roles.none}</span>}
          {parents && parents.parentRoleIds.length > 0 && (
            <div className="role-panel-list">
              {parents.parentRoleIds.map((parentId) => {
                const roleNodeId = selectedRoleId ? `role:${selectedRoleId.replace(/-/g, '')}` : '';
                const parentNodeId = `role:${parentId.replace(/-/g, '')}`;
                const relation = edges.find((edge) => edge.source === parentNodeId && edge.target === roleNodeId);
                return (
                  <div key={parentId} className="role-ledger-row">
                    <span className="note">{parentId}</span>
                    {relation?.data?.relationType && <span className="hint">{relation.data.relationType}</span>}
                    {selectedRoleCanLink && (
                      <button type="button" className="ghost" onClick={() => handlers.onDeleteParent(parentId)}>
                        {copy.account.roles.parentsRemoveAction}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {selectedRoleId && (
        <div className="role-panel-block">
          <strong>{copy.account.roles.verifyTitle}</strong>
          <button type="button" className="chip" onClick={handlers.onVerifyRole}>
            {copy.account.roles.verifyAction}
          </button>
          {verificationState === 'working' && <span className="hint">{copy.account.roles.verifyWorking}</span>}
          {verificationState === 'error' && <div className="status error">{copy.account.roles.verifyError}</div>}
          {verification && (
            <div className="role-panel-list">
              {verification.ledgers.map((ledger) => {
                const hashOk = ledger.hashMismatches === 0 && ledger.previousHashMismatches === 0;
                const sigOk = ledger.signaturesInvalid === 0 && ledger.signaturesMissing === 0;
                return (
                  <div key={ledger.ledger} className="role-ledger-row">
                    <span className="note">{ledger.ledger}</span>
                    <span className={`role-ledger-flag ${hashOk ? 'ok' : 'error'}`}>
                      {hashOk ? copy.account.roles.verifyHashOk : copy.account.roles.verifyHashIssue}
                    </span>
                    <span className={`role-ledger-flag ${sigOk ? 'ok' : 'error'}`}>
                      {sigOk ? copy.account.roles.verifySigOk : copy.account.roles.verifySigIssue}
                    </span>
                    <span className="hint">
                      {copy.account.roles.verifyRoleSigned.replace('{count}', String(ledger.roleSignedEntries))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {selectedNode && selectedNode.data.nodeType === 'data' && selectedRoleCanWrite && (
        <form className="role-panel-form" onSubmit={handlers.onUpdateField}>
          <strong>{copy.account.roles.dataEditTitle}</strong>
          <label>
            {copy.account.roles.dataValueLabel}
            <input type="text" value={form.dataValue} onChange={(event) => setForm.setDataValue(event.target.value)} />
          </label>
          <div className="role-panel-actions">
            <button type="submit" className="chip">
              {copy.account.roles.dataEditAction}
            </button>
            <button type="button" className="ghost" onClick={handlers.onDeleteField}>
              {copy.account.roles.dataDeleteAction}
            </button>
          </div>
        </form>
      )}
      {selectedNode && (
        <>
          <div className="role-panel-block">
            <strong>{copy.account.roles.incomingTitle}</strong>
            {selectedNode.data.incomingTypes.length === 0 && <span className="hint">{copy.account.roles.none}</span>}
            {selectedNode.data.incomingTypes.map((type) => (
              <div key={type}>
                <span className="note">{type}</span>
              </div>
            ))}
          </div>
          <div className="role-panel-block">
            <strong>{copy.account.roles.outgoingTitle}</strong>
            {selectedNode.data.outgoingTypes.length === 0 && <span className="hint">{copy.account.roles.none}</span>}
            {selectedNode.data.outgoingTypes.map((type) => (
              <div key={type}>
                <span className="note">{type}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
