import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

export default function GetStartedScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  // Calculate responsive sizes
  const isSmallDevice = height < 700;
  const sliderWidth = width * 0.85;
  const sliderHeight = Math.min(240, Math.max(180, Math.round(width * 0.55)));

  const slides = [
    require("../assets/images/slide1.png"),
    require("../assets/images/slide2.png"),
    require("../assets/images/slide3.png"),
  ];

  // Auto slide every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => {
        const nextIndex = (prev + 1) % slides.length;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            x: nextIndex * sliderWidth,
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [slides.length, width]);

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / sliderWidth);
    setActiveSlide(index);
  };

  const handleGetStarted = () => {
    try {
      router.push("/login");
    } catch {
      // If routing is not set up yet, do nothing for now
    }
  };

  const handleRegisterOrg = () => {
    try {
      router.push("/registration");
    } catch {
      // ignore for now if route not ready
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/splash-screen.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Message + Illustration */}
      <View style={styles.content}>
        <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>
          SamaySafar
        </Text>
        <Text style={[styles.subtitle, isSmallDevice && styles.subtitleSmall]}>
          A complete bus management system for schools and organizations.
        </Text>

        {/* Image Slider */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={[
            styles.sliderContainer,
            { width: sliderWidth, height: sliderHeight },
          ]}
          contentContainerStyle={{ alignItems: "center" }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {slides.map((source, index) => (
            <View
              key={index}
              style={[
                styles.slide,
                { width: sliderWidth, height: sliderHeight },
              ]}
            >
              <Image
                source={source}
                style={[styles.illustration, { height: sliderHeight }]}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === activeSlide && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomSection}>
        <Pressable style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.getStartedText}>Get Started</Text>
        </Pressable>

        <Pressable onPress={handleRegisterOrg} hitSlop={8}>
          <Text style={styles.registerText}>Register your organization</Text>
        </Pressable>
      </View>
    </View>
  );
}

const BABY_BLUE = "#FFFFFF";
const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BABY_BLUE,
    paddingHorizontal: 24,
    paddingTop: 15,
    paddingBottom: 6,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 1,
  },
  logo: {
    width: 150,
    height: 150,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: DEEP_BLUE,
    marginBottom: 8,
    textAlign: "center",
  },
  titleSmall: {
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: DEEP_BLUE,
    opacity: 0.8,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  subtitleSmall: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  sliderContainer: {
    alignSelf: "center",
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
  },
  illustration: {
    width: "100%",
  },
  dotsContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(22, 92, 156, 0.3)", // faded blue
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DEEP_BLUE,
  },
  bottomSection: {
    alignItems: "center",
    gap: 8,
    paddingTop: 0,
  },
  getStartedButton: {
    width: "100%",
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  registerText: {
    marginTop: 4,
    fontSize: 14,
    color: DEEP_BLUE,
    textDecorationLine: "underline",
  },
});
