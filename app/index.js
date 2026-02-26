// This entry point ensures react-native-reanimated is initialized
// before any components load, fixing "__reanimatedLoggerConfig is not defined" on web.
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
