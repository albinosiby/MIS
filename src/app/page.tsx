import {redirect} from 'next/navigation';
import {currentIdentity} from '@/features/identity/server/session';
import {roleHome} from '@/features/identity/domain/access';
export default async function Home(){const identity=await currentIdentity();redirect(identity?roleHome(identity.role):'/login');}
