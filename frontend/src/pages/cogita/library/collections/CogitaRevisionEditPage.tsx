import { CogitaRevisionSettingsPage, type CogitaRevisionSettingsPageProps } from './CogitaRevisionSettingsPage';

export type CogitaRevisionEditPageProps = Omit<CogitaRevisionSettingsPageProps, 'revisionId'> & {
  revisionId?: string;
};

export function CogitaRevisionEditPage({ revisionId, ...props }: CogitaRevisionEditPageProps) {
  return <CogitaRevisionSettingsPage {...props} revisionId={revisionId} />;
}

