import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { api, API_BASE } from "./src/api";
import { clearSession, loadSession, saveSession } from "./src/storage";

const FLOOR_FALLBACK = [{ id: "floor-1", name: "Floor 1" }];
const PLACE_TYPES = ["home", "school", "industry", "office"];
const APP_TABS = [
  { key: "overview", label: "Overview" },
  { key: "devices", label: "Devices" },
  { key: "alerts", label: "Alerts" },
  { key: "settings", label: "Settings" },
];
const SETTINGS_SECTIONS = [
  { key: "profile", label: "Profile" },
  { key: "theme", label: "Theme" },
  { key: "workspace", label: "Workspace" },
  { key: "floors", label: "Floors" },
];

const EMPTY_USAGE = {
  floors: FLOOR_FALLBACK,
  rooms: [],
  appliances: [],
  settings: {
    darkMode: true,
    dailyLimit: 24,
    gridSize: 20,
    placeType: "home",
    simulationMode: "real-time",
  },
  metrics: {
    liveLoadKw: 0,
    todayUsage: 0,
    weeklyUsage: 0,
    monthlyUsage: 0,
    voltage: 229,
    current: 0,
    billEstimate: 0,
    activeDevices: 0,
    lowVoltage: false,
    overLimit: false,
    peakHour: false,
    unusualSpike: false,
    lastSyncedAt: null,
  },
  dailyHistory: [],
  setupCompleted: false,
};

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function formatInteger(value) {
  return Math.round(Number(value) || 0).toString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function normalizeUsageData(profile, fallbackSettings = {}) {
  const settings = {
    ...EMPTY_USAGE.settings,
    ...(fallbackSettings || {}),
    ...(profile?.settings || {}),
  };

  const floors = Array.isArray(profile?.floors) && profile.floors.length
    ? profile.floors.map((floor, index) => ({
      id: String(floor.id || `floor-${index + 1}`),
      name: String(floor.name || `Floor ${index + 1}`),
    }))
    : FLOOR_FALLBACK;

  return {
    floors,
    rooms: Array.isArray(profile?.rooms) ? profile.rooms : [],
    appliances: Array.isArray(profile?.appliances)
      ? profile.appliances
      : Array.isArray(profile?.devices)
        ? profile.devices
        : [],
    settings,
    metrics: {
      ...EMPTY_USAGE.metrics,
      ...(profile?.latestMetrics || profile?.metrics || {}),
    },
    dailyHistory: Array.isArray(profile?.dailyHistory) ? profile.dailyHistory : [],
    setupCompleted: Boolean(profile?.setupCompleted),
  };
}

function fallbackSummary(metrics, appliances) {
  return {
    totalPower: Math.round((Number(metrics?.liveLoadKw) || 0) * 1000),
    liveLoadKw: Number(metrics?.liveLoadKw) || 0,
    totalCurrent: Number(metrics?.current) || 0,
    averageVoltage: Number(metrics?.voltage) || 229,
    activeDevices: Number(metrics?.activeDevices) || appliances.filter((device) => device.on).length,
    warningCount: 0,
    lowVoltage: Boolean(metrics?.lowVoltage),
    unusualSpike: Boolean(metrics?.unusualSpike),
    thresholdWatts: 4000,
    updatedAt: metrics?.lastSyncedAt || new Date().toISOString(),
  };
}

function buildAlerts(summary, usage, selectedFloorId) {
  const alerts = [];
  const floorDevices = usage.appliances.filter((device) => device.floorId === selectedFloorId);
  const floorPower = floorDevices
    .filter((device) => device.on)
    .reduce((total, device) => total + Number(device.watts || 0), 0);

  if (summary.lowVoltage) {
    alerts.push({
      tone: "warning",
      title: "Low voltage detected",
      detail: `Incoming voltage is ${formatNumber(summary.averageVoltage, 1)} V. Sensitive devices may need attention.`,
    });
  }

  if (summary.unusualSpike) {
    alerts.push({
      tone: "danger",
      title: "Load spike detected",
      detail: "One or more active devices are drawing above the normal simulator profile.",
    });
  }

  if (summary.totalPower > summary.thresholdWatts) {
    alerts.push({
      tone: "warning",
      title: "High usage alert",
      detail: `Total demand is ${formatInteger(summary.totalPower)} W, above the recommended threshold.`,
    });
  }

  if (usage.settings.dailyLimit && Number(usage.metrics.todayUsage || 0) > Number(usage.settings.dailyLimit || 0)) {
    alerts.push({
      tone: "danger",
      title: "Daily limit crossed",
      detail: `${formatNumber(usage.metrics.todayUsage, 1)} kWh used today against a ${formatNumber(usage.settings.dailyLimit, 1)} kWh limit.`,
    });
  }

  if (!alerts.length && floorPower > 0) {
    alerts.push({
      tone: "info",
      title: "System stable",
      detail: "Live simulator readings are normal for the currently selected floor.",
    });
  }

  if (!alerts.length) {
    alerts.push({
      tone: "info",
      title: "No active alerts",
      detail: "Turn on a few devices to see live energy warnings and simulator behavior.",
    });
  }

  return alerts;
}

function buildTheme(darkMode) {
  if (darkMode) {
    return {
      dark: true,
      background: "#121212",
      surface: "#1E1E1E",
      surfaceSoft: "#232323",
      border: "#2A2A2A",
      text: "#E0E0E0",
      textMuted: "#A7ABA9",
      accent: "#00C853",
      accentText: "#0E1710",
      warning: "#F97316",
      shadow: "rgba(0, 200, 83, 0.18)",
      overlay: "rgba(255,255,255,0.03)",
    };
  }

  return {
    dark: false,
    background: "#FFFFFF",
    surface: "#F5F7F6",
    surfaceSoft: "#EEF3F0",
    border: "#D7DDDA",
    text: "#16211B",
    textMuted: "#66756D",
    accent: "#00A845",
    accentText: "#F9FFF9",
    warning: "#D96A12",
    shadow: "rgba(0, 168, 69, 0.15)",
    overlay: "rgba(0,0,0,0.03)",
  };
}

function createStyles(theme) {
  return StyleSheet.create({
    app: {
      flex: 1,
      backgroundColor: theme.background,
    },
    screen: {
      flexGrow: 1,
      paddingHorizontal: 18,
      paddingBottom: 110,
      paddingTop: 8,
    },
    authContainer: {
      flex: 1,
      justifyContent: "center",
      padding: 20,
      backgroundColor: theme.background,
    },
    authCard: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 14,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    authTabs: {
      flexDirection: "row",
      gap: 10,
    },
    authTabButton: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: theme.surfaceSoft,
    },
    authTabButtonActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    authTabText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14,
    },
    authTabTextActive: {
      color: theme.accentText,
    },
    input: {
      backgroundColor: theme.surfaceSoft,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 15,
    },
    label: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    wrapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    primaryButton: {
      borderRadius: 16,
      backgroundColor: theme.accent,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    primaryButtonPressed: {
      transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
      color: theme.accentText,
      fontWeight: "800",
      fontSize: 15,
    },
    secondaryButton: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceSoft,
    },
    secondaryButtonText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14,
    },
    authLink: {
      color: theme.accent,
      fontWeight: "700",
      fontSize: 14,
    },
    messageCard: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
    },
    messageInfo: {
      backgroundColor: theme.surfaceSoft,
      borderColor: theme.border,
    },
    messageSuccess: {
      backgroundColor: theme.dark ? "rgba(0,200,83,0.16)" : "rgba(0,168,69,0.12)",
      borderColor: theme.accent,
    },
    messageError: {
      backgroundColor: theme.dark ? "rgba(249,115,22,0.14)" : "rgba(217,106,18,0.1)",
      borderColor: theme.warning,
    },
    messageText: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 20,
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      marginBottom: 16,
      gap: 12,
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: theme.surfaceSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    badgeText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    welcomeTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800",
    },
    welcomeSubtext: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    floorScroller: {
      marginBottom: 16,
    },
    floorChip: {
      marginRight: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      minWidth: 96,
      alignItems: "center",
    },
    floorChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    floorChipText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 13,
    },
    floorChipTextActive: {
      color: theme.accentText,
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 16,
      gap: 14,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
    },
    sectionSubtitle: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    metricTile: {
      width: "48%",
      backgroundColor: theme.surfaceSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      minHeight: 110,
      justifyContent: "space-between",
    },
    metricLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    metricValue: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800",
    },
    metricHelper: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    roomCard: {
      backgroundColor: theme.surfaceSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    roomTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 15,
    },
    roomMeta: {
      color: theme.textMuted,
      fontSize: 12,
    },
    trendRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
      height: 140,
    },
    trendColumn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },
    trendBar: {
      width: "100%",
      borderRadius: 999,
      backgroundColor: theme.accent,
      minHeight: 8,
    },
    trendLabel: {
      color: theme.textMuted,
      fontSize: 11,
    },
    deviceCard: {
      backgroundColor: theme.surfaceSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 12,
      gap: 12,
    },
    deviceCardActive: {
      borderColor: theme.accent,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    deviceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    deviceTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      flexShrink: 1,
    },
    deviceMeta: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    deviceStatsRow: {
      flexDirection: "row",
      gap: 10,
    },
    deviceStatChip: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    deviceStatLabel: {
      color: theme.textMuted,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    deviceStatValue: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
    },
    saveBar: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 86,
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    saveMeta: {
      flex: 1,
      gap: 2,
    },
    saveTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 14,
    },
    saveSubtitle: {
      color: theme.textMuted,
      fontSize: 12,
    },
    bottomNav: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 20,
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    tabButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 16,
    },
    tabButtonActive: {
      backgroundColor: theme.accent,
    },
    tabButtonText: {
      color: theme.textMuted,
      fontWeight: "700",
      fontSize: 12,
    },
    tabButtonTextActive: {
      color: theme.accentText,
    },
    emptyState: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: "dashed",
      backgroundColor: theme.surfaceSoft,
      padding: 18,
      gap: 10,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    settingsNav: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    settingsNavButton: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    settingsNavButtonActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    settingsNavText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 13,
    },
    settingsNavTextActive: {
      color: theme.accentText,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
    },
  });
}

const MetricTile = memo(function MetricTile({ label, value, helper, styles }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
});

const DeviceCard = memo(function DeviceCard({ device, live, styles, theme, onToggle }) {
  const active = Boolean(device.on);
  const warning = Boolean(live?.warning || live?.lowVoltage || live?.spike);

  return (
    <View style={[styles.deviceCard, active && styles.deviceCardActive]}>
      <View style={styles.deviceHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.deviceTitle}>{device.name}</Text>
          <Text style={styles.deviceMeta}>
            {device.room || "Unassigned room"} • {active ? "ON" : "OFF"} • Default {formatInteger(device.watts)} W
          </Text>
        </View>
        <Switch
          value={active}
          onValueChange={onToggle}
          thumbColor={active ? theme.accent : "#9AA39E"}
          trackColor={{
            false: theme.border,
            true: theme.dark ? "rgba(0,200,83,0.35)" : "rgba(0,168,69,0.25)",
          }}
        />
      </View>
      <View style={styles.deviceStatsRow}>
        <View style={styles.deviceStatChip}>
          <Text style={styles.deviceStatLabel}>Power</Text>
          <Text style={styles.deviceStatValue}>{formatInteger(live?.power ?? (active ? device.watts : 0))} W</Text>
        </View>
        <View style={styles.deviceStatChip}>
          <Text style={styles.deviceStatLabel}>Voltage</Text>
          <Text style={styles.deviceStatValue}>{formatNumber(live?.voltage ?? 229, 1)} V</Text>
        </View>
        <View style={styles.deviceStatChip}>
          <Text style={styles.deviceStatLabel}>Current</Text>
          <Text style={styles.deviceStatValue}>{formatNumber(live?.current ?? 0, 2)} A</Text>
        </View>
      </View>
      {warning ? (
        <View style={[styles.messageCard, styles.messageError]}>
          <Text style={styles.messageText}>{live?.warningText || "Device is reporting a warning condition."}</Text>
        </View>
      ) : null}
    </View>
  );
});

function AuthScreen({
  authMode,
  setAuthMode,
  authLoading,
  authMessage,
  authTone,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  signupName,
  setSignupName,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupPlaceType,
  setSignupPlaceType,
  resetEmail,
  setResetEmail,
  resetOtp,
  setResetOtp,
  resetPassword,
  setResetPassword,
  onLogin,
  onSignup,
  onForgotPassword,
  onResetPassword,
  styles,
  theme,
}) {
  return (
    <KeyboardAvoidingView
      style={styles.authContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>Smart Electricity Tracker</Text>
        <Text style={styles.title}>One backend, two apps.</Text>
        <Text style={styles.subtitle}>
          Use the web app to build your layout and the mobile app to monitor, control, and save live device states on the go.
        </Text>

        <View style={styles.authTabs}>
          <Pressable
            onPress={() => setAuthMode("login")}
            style={[styles.authTabButton, authMode === "login" && styles.authTabButtonActive]}
          >
            <Text style={[styles.authTabText, authMode === "login" && styles.authTabTextActive]}>Login</Text>
          </Pressable>
          <Pressable
            onPress={() => setAuthMode("signup")}
            style={[styles.authTabButton, authMode === "signup" && styles.authTabButtonActive]}
          >
            <Text style={[styles.authTabText, authMode === "signup" && styles.authTabTextActive]}>Signup</Text>
          </Pressable>
        </View>

        {authMessage ? (
          <View
            style={[
              styles.messageCard,
              authTone === "error"
                ? styles.messageError
                : authTone === "success"
                  ? styles.messageSuccess
                  : styles.messageInfo,
            ]}
          >
            <Text style={styles.messageText}>{authMessage}</Text>
          </View>
        ) : null}

        {authMode === "login" ? (
          <>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Your password"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <Pressable
              onPress={onLogin}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={authLoading}
            >
              {authLoading ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Login</Text>}
            </Pressable>
            <Pressable onPress={() => setAuthMode("forgot")}>
              <Text style={styles.authLink}>Forgot password?</Text>
            </Pressable>
          </>
        ) : null}

        {authMode === "signup" ? (
          <>
            <View>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={signupName}
                onChangeText={setSignupName}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={signupEmail}
                onChangeText={setSignupEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={signupPassword}
                onChangeText={setSignupPassword}
                placeholder="Create a password"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>Place type</Text>
              <View style={styles.wrapRow}>
                {PLACE_TYPES.map((placeType) => {
                  const active = signupPlaceType === placeType;
                  return (
                    <Pressable
                      key={placeType}
                      onPress={() => setSignupPlaceType(placeType)}
                      style={[styles.settingsNavButton, active && styles.settingsNavButtonActive]}
                    >
                      <Text style={[styles.settingsNavText, active && styles.settingsNavTextActive]}>
                        {placeType.charAt(0).toUpperCase() + placeType.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable
              onPress={onSignup}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={authLoading}
            >
              {authLoading ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
            </Pressable>
          </>
        ) : null}

        {authMode === "forgot" ? (
          <>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="Enter your account email"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <Pressable
              onPress={onForgotPassword}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={authLoading}
            >
              {authLoading ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
            </Pressable>
            <Pressable onPress={() => setAuthMode("reset")}>
              <Text style={styles.authLink}>Already have the OTP?</Text>
            </Pressable>
          </>
        ) : null}

        {authMode === "reset" ? (
          <>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="Enter your account email"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>OTP</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={resetOtp}
                onChangeText={setResetOtp}
                placeholder="6-digit code"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={resetPassword}
                onChangeText={setResetPassword}
                placeholder="New password"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <Pressable
              onPress={onResetPassword}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={authLoading}
            >
              {authLoading ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Reset password</Text>}
            </Pressable>
            <Pressable onPress={() => setAuthMode("login")}>
              <Text style={styles.authLink}>Back to login</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [selectedFloorId, setSelectedFloorId] = useState("floor-1");
  const [activeTab, setActiveTab] = useState("overview");
  const [settingsSection, setSettingsSection] = useState("profile");
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authTone, setAuthTone] = useState("info");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveTone, setSaveTone] = useState("info");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [liveDevices, setLiveDevices] = useState({});
  const [liveSummary, setLiveSummary] = useState(fallbackSummary(EMPTY_USAGE.metrics, []));
  const [profileName, setProfileName] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPlaceType, setSignupPlaceType] = useState("home");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const theme = useMemo(() => buildTheme(usage.settings.darkMode !== false), [usage.settings.darkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const persistSession = useCallback(async (nextSession) => {
    setSession(nextSession);
    await saveSession(nextSession);
  }, []);

  const hydrateUsage = useCallback(async (token, sessionSettings = {}) => {
    const profile = await api.getUsageData(token);
    const normalized = normalizeUsageData(profile, sessionSettings);
    setUsage(normalized);
    setSelectedFloorId((previousFloorId) =>
      normalized.floors.some((floor) => floor.id === previousFloorId)
        ? previousFloorId
        : normalized.floors[0]?.id || "floor-1"
    );
    setLiveSummary(fallbackSummary(normalized.metrics, normalized.appliances));
    setDirty(false);
    setSaveMessage("");
    return normalized;
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const stored = await loadSession();

      if (!stored?.token) {
        if (active) {
          setBooting(false);
        }
        return;
      }

      try {
        const userData = await api.getUserData(stored.token);
        const nextSession = {
          token: stored.token,
          user: userData.user,
          settings: userData.settings,
          setupCompleted: userData.setupCompleted,
        };

        if (!active) {
          return;
        }

        await persistSession(nextSession);
        setProfileName(nextSession.user?.name || "");
        await hydrateUsage(nextSession.token, nextSession.settings);
      } catch (_error) {
        await clearSession();
        if (active) {
          setSession(null);
          setUsage(EMPTY_USAGE);
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [hydrateUsage, persistSession]);

  useEffect(() => {
    if (session?.user?.name) {
      setProfileName(session.user.name);
    }
  }, [session?.user?.name]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    const payloadDevices = usage.appliances.map((device) => ({
      deviceId: device.deviceId,
      floorId: device.floorId,
      roomId: device.roomId,
      name: device.name,
      type: device.type,
      watts: device.watts,
      on: device.on,
    }));

    if (!payloadDevices.length) {
      setLiveDevices({});
      setLiveSummary(fallbackSummary(usage.metrics, usage.appliances));
      return undefined;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const snapshot = await api.getSimulatorBatch(session.token, {
          devices: payloadDevices,
          placeType: usage.settings.placeType,
        });

        if (cancelled) {
          return;
        }

        setLiveDevices(snapshot.devices || {});
        setLiveSummary(snapshot.summary || fallbackSummary(usage.metrics, usage.appliances));
      } catch (_error) {
        if (!cancelled) {
          setLiveSummary(fallbackSummary(usage.metrics, usage.appliances));
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [session?.token, usage.appliances, usage.metrics, usage.settings.placeType]);

  const currentFloor = useMemo(
    () => usage.floors.find((floor) => floor.id === selectedFloorId) || usage.floors[0] || FLOOR_FALLBACK[0],
    [selectedFloorId, usage.floors]
  );

  const floorRooms = useMemo(
    () => usage.rooms.filter((room) => room.floorId === currentFloor.id),
    [currentFloor.id, usage.rooms]
  );

  const floorDevices = useMemo(
    () => usage.appliances.filter((device) => device.floorId === currentFloor.id),
    [currentFloor.id, usage.appliances]
  );

  const alerts = useMemo(
    () => buildAlerts(liveSummary, usage, currentFloor.id),
    [currentFloor.id, liveSummary, usage]
  );

  const lastFiveDays = useMemo(() => usage.dailyHistory.slice(-5), [usage.dailyHistory]);

  const handleAuthError = useCallback((error) => {
    setAuthTone("error");
    setAuthMessage(error.message || "Something went wrong.");
  }, []);

  const handleAuthSuccess = useCallback(
    async (data, successMessage) => {
      const nextSession = {
        token: data.token,
        user: data.user,
        settings: data.settings,
        setupCompleted: data.setupCompleted,
      };

      await persistSession(nextSession);
      setProfileName(nextSession.user?.name || "");
      await hydrateUsage(nextSession.token, nextSession.settings);
      setAuthTone("success");
      setAuthMessage(successMessage);
    },
    [hydrateUsage, persistSession]
  );

  const handleLogin = useCallback(async () => {
    setAuthLoading(true);
    try {
      const result = await api.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      await handleAuthSuccess(result, "Logged in successfully.");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setAuthLoading(false);
    }
  }, [handleAuthError, handleAuthSuccess, loginEmail, loginPassword]);

  const handleSignup = useCallback(async () => {
    setAuthLoading(true);
    try {
      const result = await api.signup({
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        placeType: signupPlaceType,
      });
      await handleAuthSuccess(result, "Account created. You can start using the mobile companion app now.");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setAuthLoading(false);
    }
  }, [handleAuthError, handleAuthSuccess, signupEmail, signupName, signupPassword, signupPlaceType]);

  const handleForgotPassword = useCallback(async () => {
    setAuthLoading(true);
    try {
      const result = await api.forgotPassword({ email: resetEmail.trim() });
      setAuthTone("success");
      setAuthMessage(result.message || "OTP sent to your email.");
      setAuthMode("reset");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setAuthLoading(false);
    }
  }, [handleAuthError, resetEmail]);

  const handleResetPassword = useCallback(async () => {
    setAuthLoading(true);
    try {
      const result = await api.resetPassword({
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        newPassword: resetPassword,
      });
      setAuthTone("success");
      setAuthMessage(result.message || "Password updated.");
      setAuthMode("login");
      setLoginEmail(resetEmail.trim());
      setLoginPassword("");
      setResetOtp("");
      setResetPassword("");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setAuthLoading(false);
    }
  }, [handleAuthError, resetEmail, resetOtp, resetPassword]);

  const updateUsage = useCallback((updater) => {
    setUsage((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      return next;
    });
    setDirty(true);
    setSaveTone("info");
    setSaveMessage("Unsaved mobile changes.");
  }, []);

  const handleToggleDevice = useCallback((deviceId) => {
    updateUsage((previous) => ({
      ...previous,
      appliances: previous.appliances.map((device) =>
        device.deviceId === deviceId
          ? { ...device, on: !device.on }
          : device
      ),
    }));
  }, [updateUsage]);

  const handleThemeChange = useCallback((darkMode) => {
    updateUsage((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        darkMode,
      },
    }));
  }, [updateUsage]);

  const handleDailyLimitChange = useCallback((value) => {
    const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
    updateUsage((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        dailyLimit: Number.isFinite(numeric) && numeric > 0 ? numeric : previous.settings.dailyLimit,
      },
    }));
  }, [updateUsage]);

  const handleAddFloor = useCallback(() => {
    updateUsage((previous) => {
      const nextNumber = previous.floors.length + 1;
      const nextFloor = { id: `floor-${nextNumber}`, name: `Floor ${nextNumber}` };
      setSelectedFloorId(nextFloor.id);
      return {
        ...previous,
        floors: [...previous.floors, nextFloor],
      };
    });
  }, [updateUsage]);

  const handleProfileSave = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateUserProfile(session.token, { name: profileName.trim() });
      const nextSession = {
        ...session,
        token: result.token || session.token,
        user: result.user,
      };
      await persistSession(nextSession);
      setSaveTone("success");
      setSaveMessage("Profile updated.");
    } catch (error) {
      setSaveTone("error");
      setSaveMessage(error.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }, [persistSession, profileName, session]);

  const handleSaveUsage = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        floors: usage.floors,
        rooms: usage.rooms,
        appliances: usage.appliances,
        settings: usage.settings,
        metrics: {
          ...usage.metrics,
          liveLoadKw: liveSummary.liveLoadKw,
          voltage: liveSummary.averageVoltage,
          current: liveSummary.totalCurrent,
          activeDevices: liveSummary.activeDevices,
          lowVoltage: liveSummary.lowVoltage,
          unusualSpike: liveSummary.unusualSpike,
          lastSyncedAt: liveSummary.updatedAt,
        },
        dailyHistory: usage.dailyHistory,
        setupCompleted: usage.setupCompleted,
      };

      await api.saveUsage(session.token, payload);
      setDirty(false);
      setSaveTone("success");
      setSaveMessage("Mobile changes saved to the backend.");
    } catch (error) {
      setSaveTone("error");
      setSaveMessage(error.message || "Unable to save right now.");
    } finally {
      setSaving(false);
    }
  }, [liveSummary, session?.token, usage]);

  const handleLogout = useCallback(async () => {
    await clearSession();
    setSession(null);
    setUsage(EMPTY_USAGE);
    setLiveDevices({});
    setLiveSummary(fallbackSummary(EMPTY_USAGE.metrics, []));
    setAuthMode("login");
    setLoginPassword("");
    setSaveMessage("");
  }, []);

  if (booting) {
    return (
      <SafeAreaView style={styles.app}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <View style={[styles.authContainer, { alignItems: "center" }]}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Loading your energy workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session?.token) {
    return (
      <SafeAreaView style={styles.app}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <AuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          authLoading={authLoading}
          authMessage={authMessage}
          authTone={authTone}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          signupName={signupName}
          setSignupName={setSignupName}
          signupEmail={signupEmail}
          setSignupEmail={setSignupEmail}
          signupPassword={signupPassword}
          setSignupPassword={setSignupPassword}
          signupPlaceType={signupPlaceType}
          setSignupPlaceType={setSignupPlaceType}
          resetEmail={resetEmail}
          setResetEmail={setResetEmail}
          resetOtp={resetOtp}
          setResetOtp={setResetOtp}
          resetPassword={resetPassword}
          setResetPassword={setResetPassword}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onForgotPassword={handleForgotPassword}
          onResetPassword={handleResetPassword}
          styles={styles}
          theme={theme}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{usage.settings.placeType} mobile</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome, {session.user?.name || "User"}</Text>
          <Text style={styles.welcomeSubtext}>
            This mobile app is your live operations companion. Use the web app for layout building, then monitor and control the saved system here.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.floorScroller}>
          {usage.floors.map((floor) => {
            const active = floor.id === currentFloor.id;
            return (
              <Pressable
                key={floor.id}
                onPress={() => setSelectedFloorId(floor.id)}
                style={[styles.floorChip, active && styles.floorChipActive]}
              >
                <Text style={[styles.floorChipText, active && styles.floorChipTextActive]}>{floor.name}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={handleAddFloor} style={styles.floorChip}>
            <Text style={styles.floorChipText}>+ Add floor</Text>
          </Pressable>
        </ScrollView>

        {activeTab === "overview" ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Energy summary</Text>
              <Text style={styles.sectionSubtitle}>
                Live simulator data for {currentFloor.name}. Total power updates every second from the shared backend.
              </Text>
              <View style={styles.metricsGrid}>
                <MetricTile
                  label="Live load"
                  value={`${formatNumber(liveSummary.liveLoadKw, 2)} kW`}
                  helper={`${formatInteger(liveSummary.totalPower)} W active`}
                  styles={styles}
                />
                <MetricTile
                  label="Voltage"
                  value={`${formatNumber(liveSummary.averageVoltage, 1)} V`}
                  helper={`${formatNumber(liveSummary.totalCurrent, 2)} A current`}
                  styles={styles}
                />
                <MetricTile
                  label="Today"
                  value={`${formatNumber(usage.metrics.todayUsage, 1)} kWh`}
                  helper={`${formatInteger(liveSummary.activeDevices)} active devices`}
                  styles={styles}
                />
                <MetricTile
                  label="Bill"
                  value={formatCurrency(usage.metrics.billEstimate)}
                  helper={`Limit ${formatNumber(usage.settings.dailyLimit, 1)} kWh/day`}
                  styles={styles}
                />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Rooms on {currentFloor.name}</Text>
              <Text style={styles.sectionSubtitle}>
                The mobile app reads the same saved floor layout as the web app.
              </Text>
              {floorRooms.length ? (
                floorRooms.map((room) => {
                  const roomDevices = floorDevices.filter((device) => device.roomId === room.id);
                  const roomPower = roomDevices.reduce(
                    (total, device) => total + (liveDevices[device.deviceId]?.power ?? (device.on ? Number(device.watts || 0) : 0)),
                    0
                  );

                  return (
                    <View key={room.id} style={styles.roomCard}>
                      <Text style={styles.roomTitle}>{room.name}</Text>
                      <Text style={styles.roomMeta}>
                        {roomDevices.length} devices • {formatInteger(roomPower)} W live load
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No rooms on this floor yet</Text>
                  <Text style={styles.emptyText}>
                    Create and arrange rooms in the web app, then reopen mobile to monitor them here.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Usage trend</Text>
              <Text style={styles.sectionSubtitle}>A quick last-five-days view for mobile-friendly reading.</Text>
              {lastFiveDays.length ? (
                <View style={styles.trendRow}>
                  {lastFiveDays.map((item) => {
                    const maxValue = Math.max(...lastFiveDays.map((entry) => Number(entry.totalKwh || 0)), 1);
                    const height = Math.max(10, (Number(item.totalKwh || 0) / maxValue) * 92);
                    return (
                      <View key={item.date} style={styles.trendColumn}>
                        <View style={[styles.trendBar, { height }]} />
                        <Text style={styles.trendLabel}>{item.date.slice(5)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No history yet</Text>
                  <Text style={styles.emptyText}>Daily history will appear here after the backend stores more readings.</Text>
                </View>
              )}
            </View>
          </>
        ) : null}

        {activeTab === "devices" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Devices on {currentFloor.name}</Text>
            <Text style={styles.sectionSubtitle}>
              Toggle device states and then save to sync your mobile changes back to the backend.
            </Text>
            {floorDevices.length ? (
              floorDevices.map((device) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  live={liveDevices[device.deviceId]}
                  styles={styles}
                  theme={theme}
                  onToggle={() => handleToggleDevice(device.deviceId)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No devices on this floor</Text>
                <Text style={styles.emptyText}>
                  Add devices in the web app layout builder, then use mobile to monitor and control them.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === "alerts" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Live alerts</Text>
            <Text style={styles.sectionSubtitle}>
              These alerts are based on the current simulator readings and your saved daily limit.
            </Text>
            {alerts.map((alert) => (
              <View
                key={`${alert.title}-${alert.detail}`}
                style={[
                  styles.messageCard,
                  alert.tone === "danger"
                    ? styles.messageError
                    : alert.tone === "warning"
                      ? styles.messageError
                      : styles.messageInfo,
                ]}
              >
                <Text style={styles.messageText}>
                  <Text style={{ fontWeight: "800" }}>{alert.title}</Text>{"\n"}
                  {alert.detail}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {activeTab === "settings" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <Text style={styles.sectionSubtitle}>
              Open one section at a time for a cleaner mobile settings experience.
            </Text>

            <View style={styles.settingsNav}>
              {SETTINGS_SECTIONS.map((section) => {
                const active = section.key === settingsSection;
                return (
                  <Pressable
                    key={section.key}
                    onPress={() => setSettingsSection(section.key)}
                    style={[styles.settingsNavButton, active && styles.settingsNavButtonActive]}
                  >
                    <Text style={[styles.settingsNavText, active && styles.settingsNavTextActive]}>{section.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {settingsSection === "profile" ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={profileName}
                    onChangeText={setProfileName}
                    placeholder="Update your name"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <Pressable
                  onPress={handleProfileSave}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                >
                  {saving ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Save profile</Text>}
                </Pressable>
              </View>
            ) : null}

            {settingsSection === "theme" ? (
              <View style={{ gap: 14 }}>
                <View style={styles.deviceCard}>
                  <Text style={styles.deviceTitle}>Theme mode</Text>
                  <Text style={styles.deviceMeta}>Switch the entire mobile app between dark and light mode.</Text>
                  <View style={[styles.row, { justifyContent: "space-between" }]}>
                    <Text style={styles.deviceMeta}>{usage.settings.darkMode !== false ? "Dark mode" : "Light mode"}</Text>
                    <Switch
                      value={usage.settings.darkMode !== false}
                      onValueChange={handleThemeChange}
                      thumbColor={usage.settings.darkMode !== false ? theme.accent : "#9AA39E"}
                      trackColor={{
                        false: theme.border,
                        true: theme.dark ? "rgba(0,200,83,0.35)" : "rgba(0,168,69,0.25)",
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {settingsSection === "workspace" ? (
              <View style={{ gap: 12 }}>
                <View style={styles.roomCard}>
                  <Text style={styles.roomTitle}>Place type</Text>
                  <Text style={styles.roomMeta}>
                    {String(usage.settings.placeType || "home").charAt(0).toUpperCase() + String(usage.settings.placeType || "home").slice(1)}
                  </Text>
                </View>
                <View style={styles.roomCard}>
                  <Text style={styles.roomTitle}>Backend</Text>
                  <Text style={styles.roomMeta}>{API_BASE}</Text>
                </View>
                <View style={styles.roomCard}>
                  <Text style={styles.roomTitle}>Daily limit</Text>
                  <Text style={styles.roomMeta}>Tap the button below to increase by 1 kWh whenever needed.</Text>
                  <Pressable
                    onPress={() => handleDailyLimitChange(String(Number(usage.settings.dailyLimit || 0) + 1))}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryButtonPressed]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Increase limit to {formatNumber(Number(usage.settings.dailyLimit || 0) + 1, 1)} kWh
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {settingsSection === "floors" ? (
              <View style={{ gap: 12 }}>
                {usage.floors.map((floor) => {
                  const active = floor.id === currentFloor.id;
                  return (
                    <Pressable
                      key={floor.id}
                      onPress={() => setSelectedFloorId(floor.id)}
                      style={[styles.deviceCard, active && styles.deviceCardActive]}
                    >
                      <Text style={styles.deviceTitle}>{floor.name}</Text>
                      <Text style={styles.deviceMeta}>
                        {usage.rooms.filter((room) => room.floorId === floor.id).length} rooms • {usage.appliances.filter((device) => device.floorId === floor.id).length} devices
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={handleAddFloor}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryButtonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Add another floor</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.divider} />

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {(dirty || saveMessage) ? (
        <View style={styles.saveBar}>
          <View style={styles.saveMeta}>
            <Text style={styles.saveTitle}>{dirty ? "Unsaved changes" : "Mobile status"}</Text>
            <Text style={styles.saveSubtitle}>
              {saveMessage || "Changes made on mobile stay local until you save them to the backend."}
            </Text>
          </View>
          <Pressable
            onPress={handleSaveUsage}
            style={({ pressed }) => [styles.primaryButton, { minWidth: 120 }, pressed && styles.primaryButtonPressed]}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.primaryButtonText}>Save layout</Text>}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomNav}>
        {APP_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
