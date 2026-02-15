import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme/tokens';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>HypertrophyOS</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>
            {this.state.error && (
              <Text style={styles.errorMessage}>{this.state.error.message}</Text>
            )}
            <Button
              title="Restart"
              onPress={() => this.setState({ hasError: false, error: null })}
              style={styles.button}
            />
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginBottom: spacing[3],
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[4],
  },
  errorMessage: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  button: {
    minWidth: 160,
  },
});
