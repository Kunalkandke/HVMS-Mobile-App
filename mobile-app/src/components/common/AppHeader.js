import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../utils/theme';

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  rightIcon,
  onRightPress,
  backgroundColor = theme.colors.primary,
  textColor = '#fff',
}) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) onBack();
    else navigation.goBack();
  };

  const showBackBtn = showBack || onBack !== undefined;
  const showRight = rightAction || (rightIcon && onRightPress);

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor }]}>
      <View style={styles.row}>
        {showBackBtn ? (
          <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={textColor} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: textColor + 'bb' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showRight ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={rightAction ? rightAction.onPress : onRightPress}
          >
            <Ionicons
              name={rightAction ? rightAction.icon : rightIcon}
              size={22}
              color={textColor}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { paddingBottom: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 52,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconPlaceholder: { width: 40 },
  titleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, letterSpacing: 0.2 },
  subtitle: { fontSize: theme.fontSize.xs, marginTop: 1 },
});

export default AppHeader;
