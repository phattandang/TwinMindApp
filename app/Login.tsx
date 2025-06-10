import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/auth';

     export default function LoginScreen() {
       const { signIn, isLoading, error } = useAuth();

       return (
         <>
           <StatusBar style="light" />
           <LinearGradient colors={['#708090', '#B09880']} style={styles.container}>
             <View style={styles.logoContainer}>
               <Image source={require('../assets/images/TwinMindSymb.png')} style={styles.CompLogo} />
             </View>

             {error ? <Text style={styles.errorText}>{error}</Text> : null}

             <View style={styles.buttonContainer}>
               <TouchableOpacity style={styles.googleButton} onPress={signIn} disabled={isLoading}>
                 <View style={styles.buttonContentWrapper}>
                   <Image source={require('../assets/images/googleSymb.png')} style={styles.logo} />
                   <Text style={styles.buttonText}>{isLoading ? 'Signing in...' : 'Continue with Google'}</Text>
                 </View>
               </TouchableOpacity>
             </View>
             <View style={styles.footer}>
               <TouchableOpacity onPress={() => Linking.openURL('https://twinmind.com/legal/privacy-policy')}>
                 <Text style={styles.link}>Privacy Policy</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 onPress={() => Linking.openURL('https://twinmind.com/legal/terms-of-service')}
                 style={{ marginLeft: 50 }}
               >
                 <Text style={styles.link}>Term of Service</Text>
               </TouchableOpacity>
             </View>
           </LinearGradient>
         </>
       );
     }

     const styles = StyleSheet.create({
       container: {
         flex: 5,
         justifyContent: 'center',
         alignItems: 'center',
         paddingHorizontal: 8,
         paddingVertical: 42,
         width: '100%',
       },
       logoContainer: {
         flex: 2,
         justifyContent: 'center',
         alignItems: 'center',
       },
       buttonContainer: {
         flex: 1,
         alignItems: 'center',
         paddingHorizontal: 0,
         width: '100%',
       },
       googleButton: {
         backgroundColor: 'white',
         paddingVertical: 12,
         paddingHorizontal: 24,
         borderRadius: 25,
         marginBottom: 12,
         width: '80%',
         alignSelf: 'center',
         alignItems: 'center',
         justifyContent: 'center',
       },
       buttonText: {
         fontWeight: '500',
         color: 'black',
         textAlign: 'center',
       },
       footer: {
         flexDirection: 'row',
         justifyContent: 'space-around',
         paddingBottom: 20,
         marginTop: 20,
       },
       link: {
         color: 'white',
         textDecorationLine: 'underline',
         marginBottom: 10,
       },
       logo: {
         width: 20,
         height: 20,
       },
       CompLogo: {
         width: 250,
         height: 250,
         marginRight: 30,
         marginTop: 100,
       },
       buttonContentWrapper: {
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'center',
         gap: 10,
       },
       errorText: {
         color: 'red',
         marginBottom: 12,
       },
     });